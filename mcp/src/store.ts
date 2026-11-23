import { Buffer } from "node:buffer";
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { same, validateDocument } from "../../src/lib/syncDocument";
import type { RemoteSessionInfo, SyncCheckpoint, SyncDocument, SyncRemoteInstance } from "./types";

export interface ActiveCardRemoteLike {
  getSession(): RemoteSessionInfo | null;
  read: SyncRemoteInstance["read"];
  commit: SyncRemoteInstance["commit"];
}

export interface WorkspaceReadResult {
  document: SyncDocument;
  revision: number;
  email: string;
  userId: string;
}

export interface MutateContext {
  document: SyncDocument;
  revision: number;
  nowMs: number;
  nowIso: string;
  undoKey: string;
}

export interface MutateStepResult<T> {
  nextDocument?: SyncDocument;
  result: T;
  changed?: boolean;
  undoSummary?: string;
}

interface UndoEntry {
  id: string;
  userId: string;
  afterRevision: number;
  beforeDocument: SyncDocument;
  summary: string;
  createdAt: string;
}

const MAX_UNDO_ENTRIES = 50;

function signUndoToken(payload: { id: string; userId: string; afterRevision: number }, undoKey: string): string {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = createHmac("sha256", undoKey).update(encoded, "utf8").digest("hex");
  return `${encoded}.${sig}`;
}

function verifyUndoToken(
  token: string,
  undoKey: string
): { id: string; userId: string; afterRevision: number } | null {
  if (typeof token !== "string") return null;
  const dotIdx = token.indexOf(".");
  if (dotIdx <= 0 || dotIdx === token.length - 1) return null;
  const encoded = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);
  if (!/^[a-f0-9]{64}$/i.test(sig)) return null;

  const expected = createHmac("sha256", undoKey).update(encoded, "utf8").digest("hex");
  const sigBuf = Buffer.from(sig.toLowerCase(), "utf8");
  const expectedBuf = Buffer.from(expected, "utf8");
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as {
      id?: unknown;
      userId?: unknown;
      afterRevision?: unknown;
    };
    if (
      typeof parsed?.id !== "string" ||
      typeof parsed?.userId !== "string" ||
      !Number.isSafeInteger(parsed?.afterRevision)
    ) {
      return null;
    }
    return {
      id: parsed.id,
      userId: parsed.userId,
      afterRevision: parsed.afterRevision as number,
    };
  } catch {
    return null;
  }
}

export function createActiveCardStore(options: {
  remote?: ActiveCardRemoteLike;
  resolveRemote?: () => Promise<ActiveCardRemoteLike>;
  maxConflictRetries?: number;
  undoKey?: string;
  now?: () => number;
}) {
  if (!options.remote && !options.resolveRemote) {
    throw new Error("ActiveCardStore requiere remote o resolveRemote.");
  }

  const undoKey = options.undoKey || randomBytes(32).toString("hex");
  const maxConflictRetries = Math.max(1, options.maxConflictRetries ?? 3);
  const nowFn = options.now || (() => Date.now());

  let remotePromise: Promise<ActiveCardRemoteLike> | null = options.remote ? Promise.resolve(options.remote) : null;
  let lastCheckpoint: SyncCheckpoint | null = null;
  let mutationQueue: Promise<unknown> = Promise.resolve();
  const undoHistory = new Map<string, UndoEntry>();

  async function ensureRemote(): Promise<ActiveCardRemoteLike> {
    if (!remotePromise) {
      remotePromise = options.resolveRemote!().catch((error) => {
        remotePromise = null;
        throw error;
      });
    }
    return remotePromise;
  }

  function recordUndoEntry(entry: UndoEntry): string {
    undoHistory.set(entry.id, entry);
    if (undoHistory.size > MAX_UNDO_ENTRIES) {
      const oldestKey = undoHistory.keys().next().value;
      if (oldestKey) undoHistory.delete(oldestKey);
    }
    return signUndoToken(
      { id: entry.id, userId: entry.userId, afterRevision: entry.afterRevision },
      undoKey
    );
  }

  async function readWorkspace(): Promise<WorkspaceReadResult> {
    const remote = await ensureRemote();
    const session = remote.getSession();
    if (!session) {
      throw new Error('No hay sesión activa para ActiveCard. Ejecutá "npm run mcp:login".');
    }
    if (lastCheckpoint && lastCheckpoint.owner !== session.userId) {
      lastCheckpoint = null;
    }

    const snapshot = await remote.read(undefined, lastCheckpoint);
    const validated = validateDocument(snapshot.document);
    lastCheckpoint = {
      owner: session.userId,
      revision: snapshot.revision,
      document: structuredClone(validated),
    };

    return {
      document: structuredClone(validated),
      revision: snapshot.revision,
      email: session.email,
      userId: session.userId,
    };
  }

  async function runMutation<T>(
    mutator: (ctx: MutateContext) => Promise<MutateStepResult<T>> | MutateStepResult<T>,
    opts: { dryRun?: boolean; undoSummary?: string } = {}
  ): Promise<{
    result: T;
    revision: number;
    dryRun: boolean;
    changed: boolean;
    undoToken: string | null;
  }> {
    const dryRun = Boolean(opts.dryRun);
    const remote = await ensureRemote();
    const session = remote.getSession();
    if (!session) {
      throw new Error('No hay sesión activa para ActiveCard. Ejecutá "npm run mcp:login".');
    }

    for (let attempt = 1; attempt <= maxConflictRetries; attempt += 1) {
      if (lastCheckpoint && lastCheckpoint.owner !== session.userId) {
        lastCheckpoint = null;
      }

      // En reintentos tras conflicto CAS forzamos lectura completa sin checkpoint local.
      const snapshot = await remote.read(undefined, attempt === 1 ? lastCheckpoint : null);
      const beforeDoc = validateDocument(structuredClone(snapshot.document));
      lastCheckpoint = {
        owner: session.userId,
        revision: snapshot.revision,
        document: structuredClone(beforeDoc),
      };

      const nowMs = nowFn();
      const nowIso = new Date(nowMs).toISOString();
      const workingDoc = structuredClone(beforeDoc);

      const step = await mutator({
        document: workingDoc,
        revision: snapshot.revision,
        nowMs,
        nowIso,
        undoKey,
      });

      const nextDoc = validateDocument(step.nextDocument ?? workingDoc);
      const hasDocChange = step.changed !== undefined ? step.changed : !same(beforeDoc, nextDoc);

      if (!hasDocChange || dryRun) {
        return {
          result: step.result,
          revision: snapshot.revision,
          dryRun,
          changed: hasDocChange,
          undoToken: null,
        };
      }

      const response = await remote.commit(nextDoc, snapshot.revision);
      if (response.ok) {
        lastCheckpoint = {
          owner: session.userId,
          revision: response.revision,
          document: structuredClone(nextDoc),
        };
        const undoToken = recordUndoEntry({
          id: randomUUID(),
          userId: session.userId,
          afterRevision: response.revision,
          beforeDocument: structuredClone(beforeDoc),
          summary: step.undoSummary || opts.undoSummary || "Operación revertible",
          createdAt: nowIso,
        });
        return {
          result: step.result,
          revision: response.revision,
          dryRun: false,
          changed: true,
          undoToken,
        };
      }

      // Conflicto concurrente con móvil/web: invalidar checkpoint y reintentar con la revisión actual.
      lastCheckpoint = null;
    }

    throw new Error(
      `Conflicto de concurrencia tras ${maxConflictRetries} intentos: la nube cambió desde otro dispositivo mientras aplicabas la operación.`
    );
  }

  function mutateWorkspace<T>(
    mutator: (ctx: MutateContext) => Promise<MutateStepResult<T>> | MutateStepResult<T>,
    opts: { dryRun?: boolean; undoSummary?: string } = {}
  ) {
    const task = mutationQueue.then(() => runMutation(mutator, opts));
    mutationQueue = task.catch(() => {});
    return task;
  }

  function undoAction(undoToken: string) {
    const task = mutationQueue.then(async () => {
      const parsed = verifyUndoToken(undoToken, undoKey);
      if (!parsed) {
        throw new Error("El undoToken no es válido o su firma no coincide.");
      }

      const remote = await ensureRemote();
      const session = remote.getSession();
      if (!session) {
        throw new Error('No hay sesión activa para ActiveCard. Ejecutá "npm run mcp:login".');
      }
      if (parsed.userId !== session.userId) {
        throw new Error("El undoToken pertenece a otra cuenta.");
      }

      const entry = undoHistory.get(parsed.id);
      if (!entry) {
        throw new Error(
          "El undoToken expiró, ya fue utilizado o pertenece a una sesión anterior del servidor."
        );
      }

      const latest = await remote.read(undefined, null);
      if (latest.revision !== entry.afterRevision) {
        throw new Error(
          `No se puede deshacer automáticamente: la nube avanzó de la revisión ${entry.afterRevision} a la ${latest.revision} desde otro cambio.`
        );
      }

      const restored = validateDocument(structuredClone(entry.beforeDocument));
      const response = await remote.commit(restored, latest.revision);
      if (!response.ok) {
        lastCheckpoint = null;
        throw new Error("Otro dispositivo modificó la nube justo al intentar deshacer. Reintentá tras revisar.");
      }

      undoHistory.delete(parsed.id);
      lastCheckpoint = {
        owner: session.userId,
        revision: response.revision,
        document: structuredClone(restored),
      };

      return {
        undone: true,
        summary: entry.summary,
        revertedFromRevision: entry.afterRevision,
        revision: response.revision,
      };
    });
    mutationQueue = task.catch(() => {});
    return task;
  }

  return {
    undoKey,
    readWorkspace,
    mutateWorkspace,
    undoAction,
    now: nowFn,
  };
}

export type ActiveCardStore = ReturnType<typeof createActiveCardStore>;
