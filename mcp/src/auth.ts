import { Buffer } from "node:buffer";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import readline from "node:readline";
import { createSyncRemote, PUBLIC_KEY, SYNC_URL } from "../../src/lib/syncRemote";
import type { SyncRemoteInstance } from "./types";

export interface StoredMcpSession {
  url: string;
  userId: string;
  email: string;
  refreshToken: string;
  updatedAt: string;
}

export interface McpSyncConfig {
  url: string;
  publicKey: string;
}

function isServiceRoleKey(key: string): boolean {
  const trimmed = key.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("sb_secret_")) return true;
  const parts = trimmed.split(".");
  if (parts.length !== 3) return false;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as { role?: unknown };
    return payload?.role === "service_role";
  } catch {
    return false;
  }
}

export function resolveMcpSyncConfig(env: NodeJS.ProcessEnv = process.env): McpSyncConfig {
  const rawUrl = env.ACTIVECARD_SUPABASE_URL?.trim() || SYNC_URL;
  const url = rawUrl.replace(/\/+$/, "");
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("ACTIVECARD_SUPABASE_URL no es una URL válida.");
  }
  const isLocalHttp = parsed.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsed.hostname);
  if (parsed.protocol !== "https:" && !isLocalHttp) {
    throw new Error("ACTIVECARD_SUPABASE_URL debe usar HTTPS.");
  }

  const publicKey = (env.ACTIVECARD_SUPABASE_KEY?.trim() || PUBLIC_KEY).trim();
  if (!publicKey) {
    throw new Error("Falta la clave pública de Supabase para ActiveCard.");
  }
  if (isServiceRoleKey(publicKey)) {
    throw new Error("Por seguridad nunca se permite una clave service_role en activecard-mcp.");
  }

  return { url, publicKey };
}

export function resolveSessionPath(env: NodeJS.ProcessEnv = process.env, explicitPath?: string): string {
  const override = explicitPath?.trim() || env.ACTIVECARD_SESSION_PATH?.trim();
  if (override) return path.resolve(override);
  const appData = env.APPDATA?.trim();
  if (appData) {
    return path.join(appData, "activecard-mcp", "session.json");
  }
  const xdgConfig = env.XDG_CONFIG_HOME?.trim();
  if (xdgConfig) {
    return path.join(xdgConfig, "activecard-mcp", "session.json");
  }
  return path.join(os.homedir(), ".config", "activecard-mcp", "session.json");
}

function validateStoredSession(raw: unknown): StoredMcpSession {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("El archivo de sesión de activecard-mcp no tiene un formato válido.");
  }
  const data = raw as Record<string, unknown>;
  if (
    typeof data.url !== "string" ||
    !data.url.trim() ||
    typeof data.userId !== "string" ||
    !data.userId.trim() ||
    typeof data.refreshToken !== "string" ||
    !data.refreshToken.trim() ||
    typeof data.email !== "string"
  ) {
    throw new Error("La sesión guardada de activecard-mcp está incompleta.");
  }
  return {
    url: data.url.trim().replace(/\/+$/, ""),
    userId: data.userId.trim(),
    email: data.email.trim(),
    refreshToken: data.refreshToken,
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : new Date(0).toISOString(),
  };
}

export function loadStoredSession(sessionPath: string): StoredMcpSession | null {
  if (!fs.existsSync(sessionPath)) return null;
  const raw = fs.readFileSync(sessionPath, "utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`No pude leer la sesión en ${sessionPath}. Ejecutá "npm run mcp:login" nuevamente.`);
  }
  return validateStoredSession(parsed);
}

export function saveStoredSession(sessionPath: string, session: StoredMcpSession): StoredMcpSession {
  const sanitized = validateStoredSession(session);
  const dir = path.dirname(sessionPath);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const tmpPath = path.join(dir, `.session-${process.pid}-${randomUUID()}.tmp`);
  try {
    // Nunca persistimos contraseña ni accessToken: solo el refreshToken rotatorio y metadatos de cuenta.
    fs.writeFileSync(tmpPath, JSON.stringify(sanitized, null, 2) + "\n", { encoding: "utf8", mode: 0o600 });
    fs.renameSync(tmpPath, sessionPath);
    try {
      fs.chmodSync(sessionPath, 0o600);
    } catch {
      // En Windows chmod POSIX puede no aplicar; se ignora sin romper.
    }
  } finally {
    if (fs.existsSync(tmpPath)) {
      fs.rmSync(tmpPath, { force: true });
    }
  }
  return sanitized;
}

export function clearStoredSession(sessionPath: string): void {
  fs.rmSync(sessionPath, { force: true });
}

async function sha256Hex(text: string): Promise<string> {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export async function createAuthenticatedClient(
  options: {
    env?: NodeJS.ProcessEnv;
    fetch?: typeof fetch;
    sessionPath?: string;
    requireSession?: boolean;
  } = {}
) {
  const env = options.env || process.env;
  const config = resolveMcpSyncConfig(env);
  const sessionPath = resolveSessionPath(env, options.sessionPath);
  const stored = loadStoredSession(sessionPath);
  if (stored && stored.url !== config.url) {
    throw new Error(
      `La sesión guardada en ${sessionPath} pertenece a otro proyecto Supabase (${stored.url}). Cerrá sesión con "npm run mcp:logout" antes de cambiar de proyecto.`
    );
  }

  const envRefreshToken = env.ACTIVECARD_REFRESH_TOKEN?.trim() || "";
  const persistOnRefresh = Boolean(stored) || !envRefreshToken || Boolean(env.ACTIVECARD_SESSION_PATH?.trim());

  let currentRefreshToken: string | null = envRefreshToken || stored?.refreshToken || null;

  const remote = (createSyncRemote as unknown as (opts: Record<string, unknown>) => SyncRemoteInstance)({
    url: config.url,
    publicKey: config.publicKey,
    fetcher: options.fetch || globalThis.fetch,
    hash: sha256Hex,
    uuid: () => randomUUID(),
    store: {
      readRememberSession: async () => true,
      readRefreshToken: async () => currentRefreshToken,
      saveRefreshToken: async (token: string | null) => {
        currentRefreshToken = token;
      },
    },
    async onSession(info: { userId: string; email: string; refreshToken: string } | null) {
      if (!info) {
        if (persistOnRefresh) clearStoredSession(sessionPath);
        return;
      }
      if (!persistOnRefresh) return;
      saveStoredSession(sessionPath, {
        url: config.url,
        userId: info.userId,
        email: info.email,
        refreshToken: info.refreshToken,
        updatedAt: new Date().toISOString(),
      });
    },
  });

  if (currentRefreshToken) {
    await remote.restore();
  } else if (options.requireSession !== false) {
    throw new Error(
      `No hay una sesión conectada para ActiveCard MCP (${sessionPath}). Ejecutá "npm run mcp:login" para iniciar sesión con tu cuenta.`
    );
  }

  return {
    remote,
    config,
    sessionPath,
    getSession: () => remote.getSession(),
  };
}

async function promptLine(label: string, hidden = false): Promise<string> {
  const stdin = process.stdin;
  const stderr = process.stderr;

  if (!hidden || !stdin.isTTY) {
    const rl = readline.createInterface({ input: stdin, output: stderr, terminal: Boolean(stdin.isTTY) });
    return await new Promise<string>((resolve) => {
      rl.question(label, (answer: string) => {
        rl.close();
        resolve(answer.trim());
      });
    });
  }

  stderr.write(label);
  return await new Promise<string>((resolve, reject) => {
    const wasRaw = Boolean((stdin as NodeJS.ReadStream).isRaw);
    let value = "";
    const cleanup = () => {
      stdin.off("data", onData);
      if (typeof (stdin as NodeJS.ReadStream).setRawMode === "function") {
        (stdin as NodeJS.ReadStream).setRawMode(wasRaw);
      }
      stdin.pause();
    };
    const onData = (chunk: Buffer | Uint8Array | string) => {
      const str = typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
      for (const ch of str) {
        if (ch === "\r" || ch === "\n") {
          stderr.write("\n");
          cleanup();
          resolve(value);
          return;
        }
        if (ch === "\u0003") {
          stderr.write("\n");
          cleanup();
          reject(new Error("Inicio de sesión cancelado."));
          return;
        }
        if (ch === "\u007f" || ch === "\b") {
          if (value.length > 0) value = value.slice(0, -1);
          continue;
        }
        value += ch;
      }
    };
    (stdin as NodeJS.ReadStream).setRawMode(true);
    stdin.resume();
    stdin.on("data", onData);
  });
}

export async function runCliLogin(
  options: { env?: NodeJS.ProcessEnv; fetch?: typeof fetch; sessionPath?: string } = {}
) {
  const env = options.env || process.env;
  const { remote, sessionPath, config } = await createAuthenticatedClient({
    ...options,
    env: { ...env, ACTIVECARD_REFRESH_TOKEN: "" },
    requireSession: false,
  });

  const existing = loadStoredSession(sessionPath);
  if (existing && existing.url !== config.url) {
    throw new Error(
      `Existe una sesión previa de otro proyecto (${existing.url}). Ejecutá logout primero o usá ACTIVECARD_SESSION_PATH.`
    );
  }

  const emailDefault = env.ACTIVECARD_EMAIL?.trim() || existing?.email || "";
  const emailPrompt = emailDefault ? `Email de ActiveCard [${emailDefault}]: ` : "Email de ActiveCard: ";
  const enteredEmail = await promptLine(emailPrompt, false);
  const email = enteredEmail || emailDefault;
  if (!email) {
    throw new Error("Falta el email de tu cuenta ActiveCard.");
  }

  const password = await promptLine("Contraseña (no se guarda en disco): ", true);
  if (!password) {
    throw new Error("Falta la contraseña.");
  }

  const user = await remote.login(email, password, true);
  process.stderr.write(
    `Sesión conectada para ${user.email || "(sin email)"} (userId: ${user.id}).\nGuardada en: ${sessionPath}\n`
  );
  return user;
}

export async function runCliLogout(
  options: { env?: NodeJS.ProcessEnv; fetch?: typeof fetch; sessionPath?: string } = {}
) {
  const env = options.env || process.env;
  const sessionPath = resolveSessionPath(env, options.sessionPath);
  const stored = loadStoredSession(sessionPath);
  if (!stored) {
    process.stderr.write(`No había ninguna sesión guardada en ${sessionPath}.\n`);
    return { signedOut: false, sessionPath };
  }
  try {
    const auth = await createAuthenticatedClient({ ...options, requireSession: true });
    await auth.remote.logout();
  } catch {
    // Si el refresh token ya venció remotamente, igual limpiamos la sesión local.
    clearStoredSession(sessionPath);
  }
  process.stderr.write(`Sesión desconectada y eliminada de ${sessionPath}.\n`);
  return { signedOut: true, sessionPath };
}

export async function runCliStatus(
  options: { env?: NodeJS.ProcessEnv; fetch?: typeof fetch; sessionPath?: string } = {}
) {
  const env = options.env || process.env;
  const sessionPath = resolveSessionPath(env, options.sessionPath);
  const stored = loadStoredSession(sessionPath);
  if (!stored && !env.ACTIVECARD_REFRESH_TOKEN?.trim()) {
    process.stderr.write(`Sin sesión activa (${sessionPath}).\n`);
    return { connected: false, sessionPath };
  }
  const auth = await createAuthenticatedClient({ ...options, requireSession: true });
  const session = auth.getSession();
  const snapshot = await auth.remote.read();
  const doc = snapshot.document;
  const counts = {
    folders: Object.keys(doc.folders).length,
    decks: Object.keys(doc.decks).length,
    cards: Object.keys(doc.cards).length,
    notes: Object.keys(doc.notes).length,
  };
  process.stderr.write(
    `Conectado como ${session?.email || stored?.email || "(sin email)"} (${session?.userId}).\nProyecto: ${auth.config.url}\nRevisión nube: ${snapshot.revision}\nBiblioteca: ${counts.folders} carpetas, ${counts.decks} mazos, ${counts.cards} tarjetas, ${counts.notes} notas\nSesión: ${sessionPath}\n`
  );
  return {
    connected: true,
    email: session?.email || "",
    userId: session?.userId || "",
    projectUrl: auth.config.url,
    revision: snapshot.revision,
    counts,
    sessionPath,
  };
}
