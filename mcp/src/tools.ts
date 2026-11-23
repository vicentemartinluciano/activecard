import { randomUUID } from "node:crypto";
import { canMoveFolder, flattenFolders, folderPath } from "../../src/lib/folderTree";
import { compileGeneratedBack } from "../../src/lib/generatedCardFormat";
import { buildDailyQueue, endOfDay, startOfDay } from "../../src/lib/queue";
import { hasRichContent, toPlainText } from "../../src/lib/richtext";
import { newCardState } from "../../src/lib/scheduler";
import { normalizeSearch } from "../../src/lib/search";
import { countStreak } from "../../src/lib/streak";
import { canonical } from "../../src/lib/syncDocument";
import type { McpToolDefinition } from "./protocol";
import type { ActiveCardStore } from "./store";
import type { CardRow, DeckRow, FolderRow, LinkPair, NoteRow, SyncDocument } from "./types";

const DEFAULT_MAX_REVIEWS = 40;
const DEFAULT_MAX_NEW = 15;
const RECALL_POINTS: Record<"good" | "hard" | "again", number> = { good: 1, hard: 0.5, again: 0 };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function asLimit(value: unknown, fallback = 100, max = 500): number {
  if (value === undefined) return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > max) {
    throw new Error(`limit debe ser un entero entre 1 y ${max}.`);
  }
  return n;
}

function localDayKey(value: Date | string | number): string {
  const d = value instanceof Date ? value : new Date(value);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysAgoStart(days: number, now: Date): Date {
  const d = startOfDay(now);
  d.setDate(d.getDate() - days);
  return d;
}

function readDailyLimits(doc: SyncDocument): { maxReviews: number; maxNew: number } {
  const row = doc.study_preferences?.dailyLimits;
  return {
    maxReviews: Number.isInteger(row?.max_reviews) ? row.max_reviews : DEFAULT_MAX_REVIEWS,
    maxNew: Number.isInteger(row?.max_new) ? row.max_new : DEFAULT_MAX_NEW,
  };
}

function buildExcerpt(body: string): string {
  return toPlainText(String(body || ""))
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
}

function computeRecallScore(logs: { rating: "again" | "hard" | "good" }[]): number | null {
  if (!logs.length) return null;
  let points = 0;
  for (const row of logs) {
    points += RECALL_POINTS[row.rating] ?? 0;
  }
  return Math.round((points / logs.length) * 100);
}

function normalizeLinkPairs(pairs: LinkPair[]): LinkPair[] {
  const dedup = new Map<string, LinkPair>();
  for (const pair of pairs) {
    dedup.set(canonical(pair), [pair[0], pair[1]]);
  }
  return Array.from(dedup.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, pair]) => pair);
}

function pruneUnusedTags(doc: SyncDocument): void {
  const used = new Set<string>();
  for (const [, tagId] of doc.deck_tags) used.add(tagId);
  for (const [, tagId] of doc.note_tags) used.add(tagId);
  for (const tagId of Object.keys(doc.tags)) {
    if (!used.has(tagId)) delete doc.tags[tagId];
  }
}

function ensureTagId(doc: SyncDocument, rawName: string): string {
  const clean = rawName.trim();
  if (!clean) {
    throw new Error("El nombre de la etiqueta no puede quedar vacío.");
  }
  const normalized = clean.toLowerCase();
  for (const [tagId, row] of Object.entries(doc.tags)) {
    if (row.name.trim().toLowerCase() === normalized) {
      return tagId;
    }
  }
  const tagId = `tag:${clean}`;
  doc.tags[tagId] = { name: clean };
  return tagId;
}

function resolveTagIds(doc: SyncDocument, rawNames: unknown): string[] {
  if (!Array.isArray(rawNames)) {
    throw new Error("tagNames debe ser una lista de nombres de etiquetas.");
  }
  const ids = new Set<string>();
  for (const raw of rawNames) {
    if (typeof raw !== "string") {
      throw new Error("Cada etiqueta en tagNames debe ser texto.");
    }
    const trimmed = raw.trim();
    if (!trimmed) continue;
    ids.add(ensureTagId(doc, trimmed));
  }
  return [...ids];
}

function resolveRefId(rawId: unknown, refMap: Map<string, string>): string {
  if (typeof rawId !== "string" || !rawId.trim()) {
    throw new Error("Se esperaba un identificador de texto válido.");
  }
  const trimmed = rawId.trim();
  if (trimmed.startsWith("$ref:")) {
    const key = trimmed.slice(5).trim();
    const mapped = refMap.get(key);
    if (!mapped) throw new Error(`Referencia $ref:${key} no encontrada en este lote.`);
    return mapped;
  }
  return refMap.get(trimmed) || trimmed;
}

function resolveOptionalRefId(rawId: unknown, refMap: Map<string, string>): string | null {
  if (rawId === null || rawId === undefined) return null;
  return resolveRefId(rawId, refMap);
}

function folderListWithIds(doc: SyncDocument): (FolderRow & { id: string })[] {
  return Object.entries(doc.folders).map(([id, row]) => ({ id, ...row }));
}

function summarizeNoteLinks(doc: SyncDocument, noteId: string) {
  const decks = doc.note_decks
    .filter(([nid]) => nid === noteId)
    .map(([, deckId]) => ({ id: deckId, name: doc.decks[deckId]?.name || "", folder_id: doc.decks[deckId]?.folder_id ?? null }))
    .filter((d) => d.name);
  const folders = doc.note_folders
    .filter(([nid]) => nid === noteId)
    .map(([, folderId]) => ({
      id: folderId,
      name: doc.folders[folderId]?.name || "",
      parent_id: doc.folders[folderId]?.parent_id ?? null,
    }))
    .filter((f) => f.name);
  const tags = doc.note_tags
    .filter(([nid]) => nid === noteId)
    .map(([, tagId]) => ({ id: tagId, name: doc.tags[tagId]?.name || "" }))
    .filter((t) => t.name);
  return { decks, folders, tags };
}

function serializeNoteSummary(doc: SyncDocument, id: string, note: NoteRow) {
  const links = summarizeNoteLinks(doc, id);
  return {
    id,
    title: note.title,
    description: note.description || "",
    excerpt: note.excerpt,
    icon: note.icon,
    pinned: Boolean(note.pinned),
    createdAt: note.created_at,
    updatedAt: note.updated_at,
    deckIds: links.decks.map((d) => d.id),
    folderIds: links.folders.map((f) => f.id),
    tagNames: links.tags.map((t) => t.name),
  };
}

function notesForDeck(doc: SyncDocument, deckId: string) {
  const deck = doc.decks[deckId];
  if (!deck) return { direct: [], fromFolder: [], byTag: [], all: [] };
  const folders = folderListWithIds(doc);
  const ancestors = [...folderPath(folders, deck.folder_id)].reverse();
  const ancestorIndex = new Map(ancestors.map((folder, index) => [folder.id, index]));
  const deckTagIds = new Set(doc.deck_tags.filter(([did]) => did === deckId).map(([, tid]) => tid));

  const direct: unknown[] = [];
  const fromFolder: unknown[] = [];
  const byTag: unknown[] = [];

  const sortedNotes = Object.entries(doc.notes).sort(([, a], [, b]) => {
    if ((b.pinned || 0) !== (a.pinned || 0)) return (b.pinned || 0) - (a.pinned || 0);
    return b.updated_at.localeCompare(a.updated_at);
  });

  for (const [noteId, note] of sortedNotes) {
    const summary = serializeNoteSummary(doc, noteId, note);
    if (summary.deckIds.includes(deckId)) {
      direct.push({ ...summary, origin: { kind: "direct", label: "Mazo" } });
      continue;
    }
    const matchedFolders = summary.folderIds
      .filter((fid) => ancestorIndex.has(fid))
      .sort((a, b) => (ancestorIndex.get(a) ?? 0) - (ancestorIndex.get(b) ?? 0));
    if (matchedFolders.length) {
      const folderId = matchedFolders[0];
      fromFolder.push({
        ...summary,
        origin: {
          kind: "folder",
          folderId,
          folderName: doc.folders[folderId]?.name || "",
          label: `Carpeta · ${doc.folders[folderId]?.name || ""}`,
        },
      });
      continue;
    }
    const matchedTagId = doc.note_tags.find(([nid, tid]) => nid === noteId && deckTagIds.has(tid))?.[1];
    if (matchedTagId) {
      const tagName = doc.tags[matchedTagId]?.name || "";
      byTag.push({
        ...summary,
        origin: { kind: "tag", tagId: matchedTagId, tagName, label: `#${tagName}` },
      });
    }
  }

  return { direct, fromFolder, byTag, all: [...direct, ...fromFolder, ...byTag] };
}

function notesForFolder(doc: SyncDocument, folderId: string) {
  if (!doc.folders[folderId]) return { direct: [], fromAncestor: [], fromDescendants: [], all: [] };
  const folders = folderListWithIds(doc);
  const ancestors = folderPath(folders, folderId).filter((f) => f.id !== folderId).reverse();
  const ancestorIndex = new Map(ancestors.map((f, index) => [f.id, index]));
  const subtree = new Set(
    folders
      .filter((f) => f.id === folderId || folderPath(folders, f.id).some((part) => part.id === folderId))
      .map((f) => f.id)
  );
  const descendantFolderIds = new Set([...subtree].filter((id) => id !== folderId));
  const subtreeDeckIds = new Set(
    Object.entries(doc.decks)
      .filter(([, d]) => d.folder_id && subtree.has(d.folder_id))
      .map(([id]) => id)
  );

  const direct: unknown[] = [];
  const fromAncestor: unknown[] = [];
  const fromDescendants: unknown[] = [];

  const sortedNotes = Object.entries(doc.notes).sort(([, a], [, b]) => {
    if ((b.pinned || 0) !== (a.pinned || 0)) return (b.pinned || 0) - (a.pinned || 0);
    return b.updated_at.localeCompare(a.updated_at);
  });

  for (const [noteId, note] of sortedNotes) {
    const summary = serializeNoteSummary(doc, noteId, note);
    if (summary.folderIds.includes(folderId)) {
      direct.push({ ...summary, origin: { kind: "direct", label: "Esta carpeta" } });
      continue;
    }
    const matchedAncestors = summary.folderIds
      .filter((fid) => ancestorIndex.has(fid))
      .sort((a, b) => (ancestorIndex.get(a) ?? 0) - (ancestorIndex.get(b) ?? 0));
    if (matchedAncestors.length) {
      const fid = matchedAncestors[0];
      fromAncestor.push({
        ...summary,
        origin: {
          kind: "folder",
          folderId: fid,
          folderName: doc.folders[fid]?.name || "",
          label: `Carpeta · ${doc.folders[fid]?.name || ""}`,
        },
      });
      continue;
    }
    const matchedDeckId = summary.deckIds.find((did) => subtreeDeckIds.has(did));
    const matchedSubfolderId = summary.folderIds.find((fid) => descendantFolderIds.has(fid));
    if (matchedDeckId || matchedSubfolderId) {
      const label = matchedDeckId
        ? `Mazo · ${doc.decks[matchedDeckId]?.name || ""}`
        : `Subcarpeta · ${doc.folders[matchedSubfolderId!]?.name || ""}`;
      fromDescendants.push({
        ...summary,
        origin: { kind: "descendant", label },
      });
    }
  }

  return { direct, fromAncestor, fromDescendants, all: [...direct, ...fromAncestor, ...fromDescendants] };
}

function computeDailyStats(doc: SyncDocument, now: Date) {
  const startMs = startOfDay(now).getTime();
  const limits = readDailyLimits(doc);

  const logsByCardToday = new Map<string, { rating: "again" | "hard" | "good"; reviewed_at: string }[]>();
  const firstReviewByCard = new Map<string, number>();

  for (const log of Object.values(doc.review_logs)) {
    const ts = Date.parse(log.reviewed_at);
    if (!Number.isFinite(ts)) continue;
    const prevFirst = firstReviewByCard.get(log.card_id);
    if (prevFirst === undefined || ts < prevFirst) {
      firstReviewByCard.set(log.card_id, ts);
    }
    if (ts >= startMs) {
      const list = logsByCardToday.get(log.card_id) || [];
      list.push({ rating: log.rating, reviewed_at: log.reviewed_at });
      logsByCardToday.set(log.card_id, list);
    }
  }

  const retryIds: string[] = [];
  for (const [cardId, entries] of logsByCardToday.entries()) {
    entries.sort((a, b) => Date.parse(b.reviewed_at) - Date.parse(a.reviewed_at));
    if (entries[0]?.rating === "again" && doc.cards[cardId] && !doc.cards[cardId].suspended) {
      retryIds.push(cardId);
    }
  }

  const reviewedToday = logsByCardToday.size;
  let newIntroducedToday = 0;
  for (const firstTs of firstReviewByCard.values()) {
    if (firstTs >= startMs) newIntroducedToday += 1;
  }

  const advancedToday = Math.max(0, reviewedToday - retryIds.length);
  const remainingLimits = {
    maxReviews: Math.max(0, limits.maxReviews - advancedToday),
    maxNew: Math.max(0, limits.maxNew - newIntroducedToday),
  };

  const deckPriorities: Record<string, number> = {};
  for (const [deckId, deck] of Object.entries(doc.decks)) {
    deckPriorities[deckId] = deck.priority;
  }

  const allCards: (CardRow & { id: string })[] = Object.entries(doc.cards).map(([id, card]) => ({
    id,
    ...card,
  }));
  const buildQueue = buildDailyQueue as unknown as (
    cards: (CardRow & { id: string })[],
    options: {
      deckPriorities: Record<string, number>;
      now: Date;
      retryIds: string[];
      limits: { maxReviews: number; maxNew: number };
    }
  ) => (CardRow & { id: string })[];
  const queue = buildQueue(allCards, {
    deckPriorities,
    now,
    retryIds,
    limits: remainingLimits,
  });

  const done = advancedToday;
  const remaining = queue.length;
  const total = done + remaining;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return {
    limits,
    done,
    remaining,
    total,
    pct,
    retryCount: retryIds.length,
    queue,
  };
}

function serializeCard(doc: SyncDocument, id: string, card: CardRow) {
  return {
    id,
    deckId: card.deck_id,
    deckName: doc.decks[card.deck_id]?.name || "",
    front: card.front,
    back: card.back,
    frontPlain: toPlainText(card.front),
    backPlain: toPlainText(card.back),
    source: card.source,
    starred: Boolean(card.starred),
    suspended: Boolean(card.suspended),
    position: card.position,
    due: card.due,
    state: card.state,
    reps: card.reps,
    lapses: card.lapses,
    stability: card.stability,
    difficulty: card.difficulty,
    scheduledDays: card.scheduled_days,
    lastReview: card.last_review,
    createdAt: card.created_at,
  };
}

function serializeDeck(doc: SyncDocument, id: string, deck: DeckRow, now: Date) {
  const endMs = endOfDay(now).getTime();
  const cards = Object.values(doc.cards).filter((c) => c.deck_id === id);
  const activeCards = cards.filter((c) => !c.suspended);
  const dueCount =
    deck.priority > 0 ? activeCards.filter((c) => Date.parse(c.due) <= endMs).length : 0;
  const tagNames = doc.deck_tags
    .filter(([did]) => did === id)
    .map(([, tid]) => doc.tags[tid]?.name || "")
    .filter(Boolean);
  return {
    id,
    name: deck.name,
    folderId: deck.folder_id,
    folderName: deck.folder_id ? doc.folders[deck.folder_id]?.name || null : null,
    priority: deck.priority,
    paused: deck.priority === 0,
    icon: deck.icon,
    createdAt: deck.created_at,
    cardCount: cards.length,
    activeCardCount: activeCards.length,
    dueCount,
    tagNames,
  };
}

function deleteCardFromDoc(doc: SyncDocument, cardId: string): void {
  if (!doc.cards[cardId]) {
    throw new Error(`La tarjeta ${cardId} no existe.`);
  }
  for (const [logId, log] of Object.entries(doc.review_logs)) {
    if (log.card_id === cardId) delete doc.review_logs[logId];
  }
  for (const [connId, conn] of Object.entries(doc.connections)) {
    if (conn.card_id === cardId) {
      delete doc.connections[connId];
    } else if (conn.hybrid_card_id === cardId) {
      conn.hybrid_card_id = null;
    }
  }
  for (const card of Object.values(doc.cards)) {
    if (card.origin_card_id === cardId) card.origin_card_id = null;
  }
  for (const chat of Object.values(doc.gym_chats)) {
    if (chat.origin_card_id === cardId) chat.origin_card_id = null;
  }
  delete doc.cards[cardId];
}

function deleteDeckFromDoc(doc: SyncDocument, deckId: string): number {
  if (!doc.decks[deckId]) {
    throw new Error(`El mazo ${deckId} no existe.`);
  }
  const cardIds = Object.entries(doc.cards)
    .filter(([, card]) => card.deck_id === deckId)
    .map(([id]) => id);
  for (const cardId of cardIds) {
    deleteCardFromDoc(doc, cardId);
  }
  doc.deck_tags = doc.deck_tags.filter(([did]) => did !== deckId);
  doc.note_decks = doc.note_decks.filter(([, did]) => did !== deckId);
  pruneUnusedTags(doc);
  delete doc.decks[deckId];
  return cardIds.length;
}

function executeSingleAction(
  doc: SyncDocument,
  rawAction: unknown,
  ctx: { nowMs: number; nowIso: string; refMap: Map<string, string> }
) {
  if (!isRecord(rawAction) || typeof rawAction.type !== "string" || !rawAction.type.trim()) {
    throw new Error("Cada acción debe ser un objeto con campo string `type`.");
  }
  const type = rawAction.type.trim();
  const refId = asOptionalString(rawAction.refId)?.trim();
  const registerRef = (id: string) => {
    if (refId) ctx.refMap.set(refId, id);
  };

  switch (type) {
    case "create_folder": {
      const name = asOptionalString(rawAction.name)?.trim() || "";
      if (!name) throw new Error("create_folder requiere un nombre no vacío.");
      const parentId = resolveOptionalRefId(rawAction.parentId, ctx.refMap);
      if (parentId !== null && !doc.folders[parentId]) {
        throw new Error(`La carpeta padre ${parentId} no existe.`);
      }
      const id = `mcp-folder-${randomUUID()}`;
      doc.folders[id] = { name, created_at: ctx.nowIso, parent_id: parentId };
      registerRef(id);
      return { type, entityType: "folder", id, name, parentId };
    }

    case "rename_folder": {
      const folderId = resolveRefId(rawAction.folderId, ctx.refMap);
      const folder = doc.folders[folderId];
      if (!folder) throw new Error(`La carpeta ${folderId} no existe.`);
      const name = asOptionalString(rawAction.name)?.trim() || "";
      if (!name) throw new Error("rename_folder requiere un nombre no vacío.");
      folder.name = name;
      return { type, entityType: "folder", id: folderId, name };
    }

    case "move_folder": {
      const folderId = resolveRefId(rawAction.folderId, ctx.refMap);
      const folder = doc.folders[folderId];
      if (!folder) throw new Error(`La carpeta ${folderId} no existe.`);
      const parentId = resolveOptionalRefId(rawAction.parentId, ctx.refMap);
      if (parentId !== null && !doc.folders[parentId]) {
        throw new Error(`La carpeta de destino ${parentId} no existe.`);
      }
      const folders = folderListWithIds(doc);
      if (!canMoveFolder(folders, folderId, parentId)) {
        throw new Error("No podés mover una carpeta dentro de sí misma o de una subcarpeta.");
      }
      folder.parent_id = parentId;
      return { type, entityType: "folder", id: folderId, parentId };
    }

    case "delete_folder": {
      const folderId = resolveRefId(rawAction.folderId, ctx.refMap);
      const folder = doc.folders[folderId];
      if (!folder) throw new Error(`La carpeta ${folderId} no existe.`);
      if (rawAction.confirmName !== folder.name) {
        throw new Error(
          `Para eliminar la carpeta "${folder.name}", confirmName debe coincidir exactamente con su nombre.`
        );
      }
      const deleteDeckIds = Array.isArray(rawAction.deleteDeckIds)
        ? rawAction.deleteDeckIds.map((id) => resolveRefId(id, ctx.refMap))
        : [];
      for (const deckId of deleteDeckIds) {
        const deck = doc.decks[deckId];
        if (!deck || deck.folder_id !== folderId) {
          throw new Error(`El mazo ${deckId} no pertenece a la carpeta que estás eliminando.`);
        }
        deleteDeckFromDoc(doc, deckId);
      }
      const fallbackParent = folder.parent_id ?? null;
      for (const child of Object.values(doc.folders)) {
        if (child.parent_id === folderId) child.parent_id = fallbackParent;
      }
      let detachedDecks = 0;
      for (const deck of Object.values(doc.decks)) {
        if (deck.folder_id === folderId) {
          deck.folder_id = null;
          detachedDecks += 1;
        }
      }
      doc.note_folders = doc.note_folders.filter(([, fid]) => fid !== folderId);
      delete doc.folders[folderId];
      return {
        type,
        entityType: "folder",
        id: folderId,
        deletedName: folder.name,
        deletedDeckCount: deleteDeckIds.length,
        detachedDeckCount: detachedDecks,
      };
    }

    case "create_deck": {
      const name = asOptionalString(rawAction.name)?.trim() || "";
      if (!name) throw new Error("create_deck requiere un nombre no vacío.");
      const folderId = resolveOptionalRefId(rawAction.folderId, ctx.refMap);
      if (folderId !== null && !doc.folders[folderId]) {
        throw new Error(`La carpeta ${folderId} no existe.`);
      }
      let priority = 100;
      if (rawAction.priority !== undefined) {
        const num = Number(rawAction.priority);
        if (!Number.isFinite(num) || num < 0 || num > 100) {
          throw new Error("priority debe ser un número entre 0 y 100.");
        }
        priority = Math.round(num);
      }
      const icon =
        rawAction.icon === undefined || rawAction.icon === null
          ? null
          : String(rawAction.icon).trim() || null;

      const id = `mcp-deck-${randomUUID()}`;
      doc.decks[id] = {
        name,
        created_at: ctx.nowIso,
        priority,
        icon,
        folder_id: folderId,
      };
      if (rawAction.tagNames !== undefined) {
        const tagIds = resolveTagIds(doc, rawAction.tagNames);
        doc.deck_tags = normalizeLinkPairs([
          ...doc.deck_tags,
          ...tagIds.map((tagId): LinkPair => [id, tagId]),
        ]);
      }
      registerRef(id);
      return { type, entityType: "deck", id, name, folderId, priority };
    }

    case "update_deck": {
      const deckId = resolveRefId(rawAction.deckId, ctx.refMap);
      const deck = doc.decks[deckId];
      if (!deck) throw new Error(`El mazo ${deckId} no existe.`);

      if (rawAction.name !== undefined) {
        const clean = asOptionalString(rawAction.name)?.trim() || "";
        if (!clean) throw new Error("El nombre del mazo no puede quedar vacío.");
        deck.name = clean;
      }
      if (Object.prototype.hasOwnProperty.call(rawAction, "folderId")) {
        const folderId = resolveOptionalRefId(rawAction.folderId, ctx.refMap);
        if (folderId !== null && !doc.folders[folderId]) {
          throw new Error(`La carpeta ${folderId} no existe.`);
        }
        deck.folder_id = folderId;
      }
      if (rawAction.priority !== undefined) {
        const num = Number(rawAction.priority);
        if (!Number.isFinite(num) || num < 0 || num > 100) {
          throw new Error("priority debe ser un número entre 0 y 100.");
        }
        deck.priority = Math.round(num);
      }
      if (Object.prototype.hasOwnProperty.call(rawAction, "icon")) {
        deck.icon = rawAction.icon === null ? null : String(rawAction.icon).trim() || null;
      }
      if (rawAction.tagNames !== undefined) {
        const tagIds = resolveTagIds(doc, rawAction.tagNames);
        doc.deck_tags = normalizeLinkPairs([
          ...doc.deck_tags.filter(([did]) => did !== deckId),
          ...tagIds.map((tagId): LinkPair => [deckId, tagId]),
        ]);
        pruneUnusedTags(doc);
      }
      return { type, entityType: "deck", id: deckId, name: deck.name, priority: deck.priority };
    }

    case "delete_deck": {
      const deckId = resolveRefId(rawAction.deckId, ctx.refMap);
      const deck = doc.decks[deckId];
      if (!deck) throw new Error(`El mazo ${deckId} no existe.`);
      if (rawAction.confirmName !== deck.name) {
        throw new Error(
          `Para eliminar el mazo "${deck.name}", confirmName debe coincidir exactamente con su nombre.`
        );
      }
      const deletedCards = deleteDeckFromDoc(doc, deckId);
      return { type, entityType: "deck", id: deckId, deletedName: deck.name, deletedCardCount: deletedCards };
    }

    case "create_card": {
      const deckId = resolveRefId(rawAction.deckId, ctx.refMap);
      if (!doc.decks[deckId]) throw new Error(`El mazo ${deckId} no existe.`);
      const front = asOptionalString(rawAction.front)?.trim() || "";
      if (!front) throw new Error("create_card requiere un frente no vacío.");
      const compiledBack = compileGeneratedBack(rawAction.back);
      if (!hasRichContent(compiledBack)) {
        throw new Error("create_card requiere un dorso con contenido válido.");
      }
      const sourceRaw = rawAction.source ?? "manual";
      if (sourceRaw !== "manual" && sourceRaw !== "ai" && sourceRaw !== "hybrid") {
        throw new Error("source debe ser manual, ai o hybrid.");
      }
      const starred = asOptionalBoolean(rawAction.starred) ? 1 : 0;
      const suspended = asOptionalBoolean(rawAction.suspended) ? 1 : 0;

      let position: number | null;
      if (Object.prototype.hasOwnProperty.call(rawAction, "position")) {
        if (rawAction.position === null) {
          position = null;
        } else {
          const posNum = Number(rawAction.position);
          if (!Number.isInteger(posNum) || posNum < 0) {
            throw new Error("position debe ser un entero >= 0 o null.");
          }
          position = posNum;
        }
      } else {
        const maxPos = Object.values(doc.cards)
          .filter((c) => c.deck_id === deckId && c.position != null)
          .reduce((acc, c) => Math.max(acc, Number(c.position)), -1);
        position = maxPos + 1;
      }

      const id = `mcp-card-${randomUUID()}`;
      const fsrs = newCardState(new Date(ctx.nowMs));
      doc.cards[id] = {
        deck_id: deckId,
        front,
        back: compiledBack,
        source: sourceRaw,
        origin_card_id: null,
        created_at: ctx.nowIso,
        due: fsrs.due || ctx.nowIso,
        stability: fsrs.stability,
        difficulty: fsrs.difficulty,
        elapsed_days: fsrs.elapsed_days,
        scheduled_days: fsrs.scheduled_days,
        reps: fsrs.reps,
        lapses: fsrs.lapses,
        learning_steps: fsrs.learning_steps,
        state: fsrs.state,
        last_review: fsrs.last_review,
        starred,
        position,
        suspended,
      };
      registerRef(id);
      return { type, entityType: "card", id, deckId };
    }

    case "update_card": {
      const cardId = resolveRefId(rawAction.cardId, ctx.refMap);
      const card = doc.cards[cardId];
      if (!card) throw new Error(`La tarjeta ${cardId} no existe.`);

      if (rawAction.deckId !== undefined) {
        const nextDeckId = resolveRefId(rawAction.deckId, ctx.refMap);
        if (!doc.decks[nextDeckId]) throw new Error(`El mazo de destino ${nextDeckId} no existe.`);
        card.deck_id = nextDeckId;
      }
      if (rawAction.front !== undefined) {
        const front = asOptionalString(rawAction.front)?.trim() || "";
        if (!front) throw new Error("El frente de la tarjeta no puede quedar vacío.");
        card.front = front;
      }
      if (rawAction.back !== undefined) {
        const compiledBack = compileGeneratedBack(rawAction.back);
        if (!hasRichContent(compiledBack)) {
          throw new Error("El dorso de la tarjeta no puede quedar vacío.");
        }
        card.back = compiledBack;
      }
      if (rawAction.starred !== undefined) {
        const val = asOptionalBoolean(rawAction.starred);
        if (val === undefined) throw new Error("starred debe ser booleano.");
        card.starred = val ? 1 : 0;
      }
      if (rawAction.suspended !== undefined) {
        const val = asOptionalBoolean(rawAction.suspended);
        if (val === undefined) throw new Error("suspended debe ser booleano.");
        card.suspended = val ? 1 : 0;
      }
      if (Object.prototype.hasOwnProperty.call(rawAction, "position")) {
        if (rawAction.position === null) {
          card.position = null;
        } else {
          const posNum = Number(rawAction.position);
          if (!Number.isInteger(posNum) || posNum < 0) {
            throw new Error("position debe ser un entero >= 0 o null.");
          }
          card.position = posNum;
        }
      }
      return { type, entityType: "card", id: cardId, deckId: card.deck_id };
    }

    case "delete_card": {
      const cardId = resolveRefId(rawAction.cardId, ctx.refMap);
      if (!doc.cards[cardId]) throw new Error(`La tarjeta ${cardId} no existe.`);
      if (rawAction.confirmDelete !== true) {
        throw new Error("delete_card requiere confirmDelete: true.");
      }
      deleteCardFromDoc(doc, cardId);
      return { type, entityType: "card", id: cardId, deleted: true };
    }

    case "create_note": {
      const title = typeof rawAction.title === "string" ? rawAction.title : "";
      const description = typeof rawAction.description === "string" ? rawAction.description : "";
      const body = typeof rawAction.body === "string" ? rawAction.body : "";
      if (!title.trim() && !description.trim() && !body.trim()) {
        throw new Error("create_note requiere al menos título, descripción o cuerpo.");
      }
      const icon =
        rawAction.icon === undefined || rawAction.icon === null
          ? null
          : String(rawAction.icon).trim() || null;
      const pinned = asOptionalBoolean(rawAction.pinned) ? 1 : 0;

      const deckIds = rawAction.deckIds === undefined
        ? []
        : Array.isArray(rawAction.deckIds)
          ? rawAction.deckIds.map((id) => resolveRefId(id, ctx.refMap))
          : (() => { throw new Error("deckIds debe ser una lista."); })();
      for (const did of deckIds) {
        if (!doc.decks[did]) throw new Error(`El mazo ${did} no existe.`);
      }

      const folderIds = rawAction.folderIds === undefined
        ? []
        : Array.isArray(rawAction.folderIds)
          ? rawAction.folderIds.map((id) => resolveRefId(id, ctx.refMap))
          : (() => { throw new Error("folderIds debe ser una lista."); })();
      for (const fid of folderIds) {
        if (!doc.folders[fid]) throw new Error(`La carpeta ${fid} no existe.`);
      }

      const id = `mcp-note-${randomUUID()}`;
      doc.notes[id] = {
        title,
        description,
        body,
        excerpt: buildExcerpt(body),
        icon,
        pinned,
        created_at: ctx.nowIso,
        updated_at: ctx.nowIso,
      };
      if (deckIds.length) {
        doc.note_decks = normalizeLinkPairs([
          ...doc.note_decks,
          ...deckIds.map((did): LinkPair => [id, did]),
        ]);
      }
      if (folderIds.length) {
        doc.note_folders = normalizeLinkPairs([
          ...doc.note_folders,
          ...folderIds.map((fid): LinkPair => [id, fid]),
        ]);
      }
      if (rawAction.tagNames !== undefined) {
        const tagIds = resolveTagIds(doc, rawAction.tagNames);
        doc.note_tags = normalizeLinkPairs([
          ...doc.note_tags,
          ...tagIds.map((tid): LinkPair => [id, tid]),
        ]);
      }
      registerRef(id);
      return { type, entityType: "note", id, title };
    }

    case "update_note": {
      const noteId = resolveRefId(rawAction.noteId, ctx.refMap);
      const note = doc.notes[noteId];
      if (!note) throw new Error(`La nota ${noteId} no existe.`);

      if (rawAction.title !== undefined) note.title = String(rawAction.title ?? "");
      if (rawAction.description !== undefined) note.description = String(rawAction.description ?? "");
      if (rawAction.body !== undefined) {
        note.body = String(rawAction.body ?? "");
        note.excerpt = buildExcerpt(note.body);
      }
      if (Object.prototype.hasOwnProperty.call(rawAction, "icon")) {
        note.icon = rawAction.icon === null ? null : String(rawAction.icon).trim() || null;
      }
      if (rawAction.pinned !== undefined) {
        const val = asOptionalBoolean(rawAction.pinned);
        if (val === undefined) throw new Error("pinned debe ser booleano.");
        note.pinned = val ? 1 : 0;
      }
      if (rawAction.deckIds !== undefined) {
        if (!Array.isArray(rawAction.deckIds)) throw new Error("deckIds debe ser una lista.");
        const deckIds = rawAction.deckIds.map((id) => resolveRefId(id, ctx.refMap));
        for (const did of deckIds) {
          if (!doc.decks[did]) throw new Error(`El mazo ${did} no existe.`);
        }
        doc.note_decks = normalizeLinkPairs([
          ...doc.note_decks.filter(([nid]) => nid !== noteId),
          ...deckIds.map((did): LinkPair => [noteId, did]),
        ]);
      }
      if (rawAction.folderIds !== undefined) {
        if (!Array.isArray(rawAction.folderIds)) throw new Error("folderIds debe ser una lista.");
        const folderIds = rawAction.folderIds.map((id) => resolveRefId(id, ctx.refMap));
        for (const fid of folderIds) {
          if (!doc.folders[fid]) throw new Error(`La carpeta ${fid} no existe.`);
        }
        doc.note_folders = normalizeLinkPairs([
          ...doc.note_folders.filter(([nid]) => nid !== noteId),
          ...folderIds.map((fid): LinkPair => [noteId, fid]),
        ]);
      }
      if (rawAction.tagNames !== undefined) {
        const tagIds = resolveTagIds(doc, rawAction.tagNames);
        doc.note_tags = normalizeLinkPairs([
          ...doc.note_tags.filter(([nid]) => nid !== noteId),
          ...tagIds.map((tid): LinkPair => [noteId, tid]),
        ]);
        pruneUnusedTags(doc);
      }
      note.updated_at = ctx.nowIso;
      return { type, entityType: "note", id: noteId, title: note.title };
    }

    case "delete_note": {
      const noteId = resolveRefId(rawAction.noteId, ctx.refMap);
      if (!doc.notes[noteId]) throw new Error(`La nota ${noteId} no existe.`);
      if (rawAction.confirmDelete !== true) {
        throw new Error("delete_note requiere confirmDelete: true.");
      }
      doc.note_decks = doc.note_decks.filter(([nid]) => nid !== noteId);
      doc.note_folders = doc.note_folders.filter(([nid]) => nid !== noteId);
      doc.note_tags = doc.note_tags.filter(([nid]) => nid !== noteId);
      pruneUnusedTags(doc);
      delete doc.notes[noteId];
      return { type, entityType: "note", id: noteId, deleted: true };
    }

    case "update_daily_limits": {
      const current = readDailyLimits(doc);
      const maxReviews =
        rawAction.maxReviews !== undefined ? Number(rawAction.maxReviews) : current.maxReviews;
      const maxNew = rawAction.maxNew !== undefined ? Number(rawAction.maxNew) : current.maxNew;
      if (!Number.isInteger(maxReviews) || maxReviews < 0 || maxReviews > 100) {
        throw new Error("maxReviews debe ser un entero entre 0 y 100.");
      }
      if (!Number.isInteger(maxNew) || maxNew < 0 || maxNew > 50) {
        throw new Error("maxNew debe ser un entero entre 0 y 50.");
      }
      doc.study_preferences.dailyLimits = {
        max_reviews: maxReviews,
        max_new: maxNew,
      };
      return { type, entityType: "study_preferences", maxReviews, maxNew };
    }

    default:
      throw new Error(`Acción no soportada: ${type}. Los repasos FSRS no se registran por MCP.`);
  }
}

export function createActiveCardTools(store: ActiveCardStore): McpToolDefinition[] {
  return [
    {
      name: "activecard_account_status",
      description:
        "Devuelve el estado de la cuenta conectada en Supabase, revisión en nube, límites diarios y conteos de biblioteca.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      handler: async () => {
        const ws = await store.readWorkspace();
        return {
          connected: true,
          email: ws.email,
          userId: ws.userId,
          revision: ws.revision,
          dailyLimits: readDailyLimits(ws.document),
          counts: {
            folders: Object.keys(ws.document.folders).length,
            decks: Object.keys(ws.document.decks).length,
            cards: Object.keys(ws.document.cards).length,
            notes: Object.keys(ws.document.notes).length,
            reviewLogs: Object.keys(ws.document.review_logs).length,
            gymChats: Object.keys(ws.document.gym_chats).length,
          },
        };
      },
    },

    {
      name: "activecard_get_overview",
      description:
        "Resumen diario del estudio: progreso del día, pendientes según prioridades y topes diarios, racha, puntaje de recuerdo a 30 días y tarjetas débiles.",
      inputSchema: {
        type: "object",
        properties: {
          weakMinLapses: { type: "integer", minimum: 1, default: 3 },
          limit: { type: "integer", minimum: 1, maximum: 50, default: 12 },
        },
        additionalProperties: false,
      },
      handler: async (args) => {
        const ws = await store.readWorkspace();
        const now = new Date(store.now());
        const doc = ws.document;
        const daily = computeDailyStats(doc, now);

        const activeDayKeys = Array.from(
          new Set(
            Object.values(doc.review_logs)
              .map((log) => (Number.isFinite(Date.parse(log.reviewed_at)) ? localDayKey(log.reviewed_at) : ""))
              .filter(Boolean)
          )
        ).sort((a, b) => b.localeCompare(a));
        const streak = countStreak(activeDayKeys, now);

        const since30Ms = daysAgoStart(30, now).getTime();
        const since60Ms = daysAgoStart(60, now).getTime();
        const current30Logs: { rating: "again" | "hard" | "good" }[] = [];
        const prev30Logs: { rating: "again" | "hard" | "good" }[] = [];
        for (const log of Object.values(doc.review_logs)) {
          const ts = Date.parse(log.reviewed_at);
          if (!Number.isFinite(ts)) continue;
          if (ts >= since30Ms) current30Logs.push(log);
          else if (ts >= since60Ms) prev30Logs.push(log);
        }
        const score30 = computeRecallScore(current30Logs);
        const prevScore30 = computeRecallScore(prev30Logs);

        const weakMinLapses =
          args.weakMinLapses === undefined
            ? 3
            : Number.isInteger(Number(args.weakMinLapses)) && Number(args.weakMinLapses) >= 1
              ? Number(args.weakMinLapses)
              : (() => { throw new Error("weakMinLapses debe ser un entero >= 1."); })();
        const sampleLimit = asLimit(args.limit, 12, 50);

        const weakCards = Object.entries(doc.cards)
          .filter(([, card]) => !card.suspended && card.lapses >= weakMinLapses)
          .sort(([, a], [, b]) => b.lapses - a.lapses)
          .slice(0, sampleLimit)
          .map(([id, card]) => ({
            id,
            deckId: card.deck_id,
            deckName: doc.decks[card.deck_id]?.name || "",
            frontPlain: toPlainText(card.front).slice(0, 140),
            lapses: card.lapses,
            reps: card.reps,
          }));

        return {
          revision: ws.revision,
          today: {
            done: daily.done,
            remaining: daily.remaining,
            total: daily.total,
            pct: daily.pct,
            retryCount: daily.retryCount,
            queueSample: daily.queue.slice(0, sampleLimit).map((c) => ({
              id: c.id,
              deckId: c.deck_id,
              deckName: doc.decks[c.deck_id]?.name || "",
              frontPlain: toPlainText(c.front).slice(0, 120),
              state: c.state,
            })),
          },
          streak,
          recall30d: {
            score: score30,
            total: current30Logs.length,
            delta: score30 !== null && prevScore30 !== null ? score30 - prevScore30 : null,
          },
          weakCards,
          dailyLimits: daily.limits,
          counts: {
            folders: Object.keys(doc.folders).length,
            decks: Object.keys(doc.decks).length,
            cards: Object.keys(doc.cards).length,
            notes: Object.keys(doc.notes).length,
          },
        };
      },
    },

    {
      name: "activecard_list_library",
      description:
        "Lista carpetas (jerárquicas), mazos, tarjetas, notas y etiquetas de la biblioteca con filtros.",
      inputSchema: {
        type: "object",
        properties: {
          entity: { type: "string", enum: ["all", "folders", "decks", "cards", "notes", "tags"], default: "all" },
          folderId: { type: "string" },
          deckId: { type: "string" },
          tag: { type: "string" },
          pinned: { type: "boolean" },
          includeSuspended: { type: "boolean", default: true },
          limit: { type: "integer", minimum: 1, maximum: 500, default: 100 },
        },
        additionalProperties: false,
      },
      handler: async (args) => {
        const ws = await store.readWorkspace();
        const doc = ws.document;
        const now = new Date(store.now());
        const entity = typeof args.entity === "string" ? args.entity : "all";
        const folderFilter = asOptionalString(args.folderId)?.trim();
        const deckFilter = asOptionalString(args.deckId)?.trim();
        const tagFilter = asOptionalString(args.tag)?.trim().toLowerCase();
        const pinnedFilter = asOptionalBoolean(args.pinned);
        const includeSuspended = args.includeSuspended !== false;
        const limit = asLimit(args.limit, 100, 500);

        const foldersWithIds = folderListWithIds(doc);
        const deckCountByFolder = new Map<string, number>();
        for (const deck of Object.values(doc.decks)) {
          if (deck.folder_id) {
            deckCountByFolder.set(deck.folder_id, (deckCountByFolder.get(deck.folder_id) || 0) + 1);
          }
        }

        const out: Record<string, unknown> = { revision: ws.revision };

        if (entity === "all" || entity === "folders") {
          const flattenedList = flattenFolders(foldersWithIds) as (FolderRow & { id: string; depth: number })[];
          const flattened = flattenedList.map((f) => ({
            id: f.id,
            name: f.name,
            parentId: f.parent_id ?? null,
            depth: f.depth,
            pathNames: folderPath(foldersWithIds, f.id).map((p) => p.name),
            deckCount: deckCountByFolder.get(f.id) || 0,
            createdAt: doc.folders[f.id]?.created_at,
          }));
          out.folders = folderFilter
            ? flattened.filter((f) => f.id === folderFilter || f.parentId === folderFilter).slice(0, limit)
            : flattened.slice(0, limit);
        }

        if (entity === "all" || entity === "decks") {
          let decks = Object.entries(doc.decks).map(([id, deck]) => serializeDeck(doc, id, deck, now));
          if (folderFilter) decks = decks.filter((d) => d.folderId === folderFilter);
          if (tagFilter) decks = decks.filter((d) => d.tagNames.some((t) => t.toLowerCase() === tagFilter));
          out.decks = decks.sort((a, b) => a.name.localeCompare(b.name)).slice(0, limit);
        }

        if (entity === "cards") {
          let cards = Object.entries(doc.cards).map(([id, card]) => serializeCard(doc, id, card));
          if (deckFilter) cards = cards.filter((c) => c.deckId === deckFilter);
          if (folderFilter) {
            cards = cards.filter((c) => doc.decks[c.deckId]?.folder_id === folderFilter);
          }
          if (!includeSuspended) cards = cards.filter((c) => !c.suspended);
          out.cards = cards.slice(0, limit);
        }

        if (entity === "all" || entity === "notes") {
          let notes = Object.entries(doc.notes)
            .sort(([, a], [, b]) => {
              if ((b.pinned || 0) !== (a.pinned || 0)) return (b.pinned || 0) - (a.pinned || 0);
              return b.updated_at.localeCompare(a.updated_at);
            })
            .map(([id, note]) => serializeNoteSummary(doc, id, note));
          if (deckFilter) notes = notes.filter((n) => n.deckIds.includes(deckFilter));
          if (folderFilter) notes = notes.filter((n) => n.folderIds.includes(folderFilter));
          if (tagFilter) notes = notes.filter((n) => n.tagNames.some((t) => t.toLowerCase() === tagFilter));
          if (pinnedFilter !== undefined) notes = notes.filter((n) => n.pinned === pinnedFilter);
          out.notes = notes.slice(0, limit);
        }

        if (entity === "all" || entity === "tags") {
          out.tags = Object.entries(doc.tags)
            .map(([id, row]) => ({ id, name: row.name }))
            .sort((a, b) => a.name.localeCompare(b.name))
            .slice(0, limit);
        }

        return out;
      },
    },

    {
      name: "activecard_search",
      description:
        "Búsqueda normalizada (sin tildes ni mayúsculas) sobre carpetas, mazos, tarjetas (texto plano) y notas.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string" },
          scope: { type: "string", enum: ["all", "folders", "decks", "cards", "notes"], default: "all" },
          limit: { type: "integer", minimum: 1, maximum: 100, default: 25 },
        },
        required: ["query"],
        additionalProperties: false,
      },
      handler: async (args) => {
        const rawQuery = asOptionalString(args.query)?.trim() || "";
        if (!rawQuery) throw new Error("query debe ser un texto no vacío.");
        const q = normalizeSearch(rawQuery);
        const scope = typeof args.scope === "string" ? args.scope : "all";
        const limit = asLimit(args.limit, 25, 100);

        const ws = await store.readWorkspace();
        const doc = ws.document;
        const now = new Date(store.now());
        const matches = (value: string) => normalizeSearch(value).includes(q);

        const result: Record<string, unknown> = { query: rawQuery, revision: ws.revision };

        if (scope === "all" || scope === "folders") {
          const allFolders = folderListWithIds(doc);
          result.folders = allFolders
            .filter((f) => matches(f.name))
            .slice(0, limit)
            .map((f) => ({
              id: f.id,
              name: f.name,
              parentId: f.parent_id,
              pathNames: folderPath(allFolders, f.id).map((p) => p.name),
            }));
        }

        if (scope === "all" || scope === "decks") {
          result.decks = Object.entries(doc.decks)
            .map(([id, deck]) => serializeDeck(doc, id, deck, now))
            .filter((d) => matches(d.name) || d.tagNames.some((t) => matches(t)))
            .slice(0, limit);
        }

        if (scope === "all" || scope === "cards") {
          result.cards = Object.entries(doc.cards)
            .filter(([, card]) => matches(toPlainText(card.front)) || matches(toPlainText(card.back)))
            .slice(0, limit)
            .map(([id, card]) => serializeCard(doc, id, card));
        }

        if (scope === "all" || scope === "notes") {
          result.notes = Object.entries(doc.notes)
            .filter(
              ([, note]) =>
                matches(note.title) || matches(note.description) || matches(toPlainText(note.body))
            )
            .slice(0, limit)
            .map(([id, note]) => serializeNoteSummary(doc, id, note));
        }

        return result;
      },
    },

    {
      name: "activecard_read_entity",
      description:
        "Lee el detalle completo de una carpeta, mazo, tarjeta, nota o chat del Gimnasio, incluyendo notas heredadas o historial de repasos.",
      inputSchema: {
        type: "object",
        properties: {
          entityType: { type: "string", enum: ["folder", "deck", "card", "note", "gym_chat"] },
          id: { type: "string" },
          includeCards: { type: "boolean", default: true },
          reviewLimit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
        },
        required: ["entityType", "id"],
        additionalProperties: false,
      },
      handler: async (args) => {
        const entityType = asOptionalString(args.entityType);
        const id = asOptionalString(args.id)?.trim();
        if (!entityType || !id) {
          throw new Error("entityType e id son obligatorios.");
        }
        const ws = await store.readWorkspace();
        const doc = ws.document;
        const now = new Date(store.now());

        if (entityType === "folder") {
          const folder = doc.folders[id];
          if (!folder) throw new Error(`No existe la carpeta ${id}.`);
          const folders = folderListWithIds(doc);
          const subfolders = folders
            .filter((f) => f.parent_id === id)
            .map((f) => ({ id: f.id, name: f.name, createdAt: f.created_at }));
          const decks = Object.entries(doc.decks)
            .filter(([, d]) => d.folder_id === id)
            .map(([did, d]) => serializeDeck(doc, did, d, now));
          return {
            entityType,
            revision: ws.revision,
            folder: {
              id,
              name: folder.name,
              parentId: folder.parent_id,
              createdAt: folder.created_at,
              path: folderPath(folders, id).map((p) => ({ id: p.id, name: p.name })),
              subfolders,
              decks,
              notes: notesForFolder(doc, id),
            },
          };
        }

        if (entityType === "deck") {
          const deck = doc.decks[id];
          if (!deck) throw new Error(`No existe el mazo ${id}.`);
          const includeCards = args.includeCards !== false;
          const folders = folderListWithIds(doc);
          const cards = includeCards
            ? Object.entries(doc.cards)
                .filter(([, c]) => c.deck_id === id)
                .sort(([, a], [, b]) => {
                  const posA = a.position ?? Number.MAX_SAFE_INTEGER;
                  const posB = b.position ?? Number.MAX_SAFE_INTEGER;
                  if (posA !== posB) return posA - posB;
                  return a.created_at.localeCompare(b.created_at);
                })
                .map(([cid, c]) => serializeCard(doc, cid, c))
            : undefined;
          return {
            entityType,
            revision: ws.revision,
            deck: {
              ...serializeDeck(doc, id, deck, now),
              folderPath: deck.folder_id
                ? folderPath(folders, deck.folder_id).map((p) => ({ id: p.id, name: p.name }))
                : [],
              notes: notesForDeck(doc, id),
              ...(cards ? { cards } : {}),
            },
          };
        }

        if (entityType === "card") {
          const card = doc.cards[id];
          if (!card) throw new Error(`No existe la tarjeta ${id}.`);
          const reviewLimit = asLimit(args.reviewLimit, 20, 100);
          const recentReviews = Object.entries(doc.review_logs)
            .filter(([, log]) => log.card_id === id)
            .sort(([, a], [, b]) => Date.parse(b.reviewed_at) - Date.parse(a.reviewed_at))
            .slice(0, reviewLimit)
            .map(([logId, log]) => ({
              id: logId,
              rating: log.rating,
              mode: log.mode,
              reviewedAt: log.reviewed_at,
            }));
          return {
            entityType,
            revision: ws.revision,
            card: {
              ...serializeCard(doc, id, card),
              recentReviews,
            },
          };
        }

        if (entityType === "note") {
          const note = doc.notes[id];
          if (!note) throw new Error(`No existe la nota ${id}.`);
          const links = summarizeNoteLinks(doc, id);
          return {
            entityType,
            revision: ws.revision,
            note: {
              ...serializeNoteSummary(doc, id, note),
              body: note.body,
              decks: links.decks.map((d) => ({ id: d.id, name: d.name })),
              folders: links.folders.map((f) => ({ id: f.id, name: f.name })),
              tags: links.tags,
            },
          };
        }

        if (entityType === "gym_chat") {
          const chat = doc.gym_chats[id];
          if (!chat) throw new Error(`No existe el chat ${id}.`);
          const messages = Object.entries(doc.gym_messages)
            .filter(([, msg]) => msg.chat_id === id)
            .sort(([, a], [, b]) => Date.parse(a.created_at) - Date.parse(b.created_at))
            .map(([msgId, msg]) => ({
              id: msgId,
              role: msg.role,
              text: msg.text,
              createdAt: msg.created_at,
            }));
          return {
            entityType,
            revision: ws.revision,
            chat: {
              id,
              title: chat.title,
              originCardId: chat.origin_card_id,
              createdAt: chat.created_at,
              updatedAt: chat.updated_at,
              messages,
            },
          };
        }

        throw new Error(`entityType no soportado: ${entityType}.`);
      },
    },

    {
      name: "activecard_get_review_history",
      description:
        "Consulta logs históricos de repaso filtrados por mazo, tarjeta o rango de fechas, con puntaje de recuerdo.",
      inputSchema: {
        type: "object",
        properties: {
          deckId: { type: "string" },
          cardId: { type: "string" },
          fromDate: { type: "string" },
          toDate: { type: "string" },
          limit: { type: "integer", minimum: 1, maximum: 500, default: 50 },
        },
        additionalProperties: false,
      },
      handler: async (args) => {
        const ws = await store.readWorkspace();
        const doc = ws.document;
        const deckId = asOptionalString(args.deckId)?.trim();
        const cardId = asOptionalString(args.cardId)?.trim();
        const fromMs = args.fromDate ? Date.parse(String(args.fromDate)) : null;
        const toMs = args.toDate ? Date.parse(String(args.toDate)) : null;
        if (fromMs !== null && !Number.isFinite(fromMs)) throw new Error("fromDate inválida.");
        if (toMs !== null && !Number.isFinite(toMs)) throw new Error("toDate inválida.");
        const limit = asLimit(args.limit, 50, 500);

        const filtered = Object.entries(doc.review_logs)
          .filter(([, log]) => {
            if (cardId && log.card_id !== cardId) return false;
            if (deckId && doc.cards[log.card_id]?.deck_id !== deckId) return false;
            const ts = Date.parse(log.reviewed_at);
            if (!Number.isFinite(ts)) return false;
            if (fromMs !== null && ts < fromMs) return false;
            if (toMs !== null && ts > toMs) return false;
            return true;
          })
          .sort(([, a], [, b]) => Date.parse(b.reviewed_at) - Date.parse(a.reviewed_at));

        let good = 0;
        let hard = 0;
        let again = 0;
        for (const [, log] of filtered) {
          if (log.rating === "good") good += 1;
          else if (log.rating === "hard") hard += 1;
          else if (log.rating === "again") again += 1;
        }

        return {
          revision: ws.revision,
          totalMatched: filtered.length,
          breakdown: { good, hard, again },
          recallScore: computeRecallScore(filtered.map(([, log]) => log)),
          entries: filtered.slice(0, limit).map(([id, log]) => {
            const card = doc.cards[log.card_id];
            return {
              id,
              cardId: log.card_id,
              deckId: card?.deck_id || null,
              deckName: card ? doc.decks[card.deck_id]?.name || "" : "",
              frontPlain: card ? toPlainText(card.front).slice(0, 100) : "",
              rating: log.rating,
              mode: log.mode,
              reviewedAt: log.reviewed_at,
            };
          }),
        };
      },
    },

    {
      name: "activecard_apply_action",
      description:
        "Aplica una acción atómica validada sobre carpetas, mazos, tarjetas, notas o límites diarios (sin registrar repasos FSRS). Devuelve undoToken si modifica la nube.",
      inputSchema: {
        type: "object",
        properties: {
          action: {
            type: "object",
            description:
              "Objeto con `type` (create_folder, rename_folder, move_folder, delete_folder, create_deck, update_deck, delete_deck, create_card, update_card, delete_card, create_note, update_note, delete_note, update_daily_limits) y sus campos.",
          },
          dryRun: { type: "boolean", default: false },
        },
        required: ["action"],
        additionalProperties: false,
      },
      handler: async (args) => {
        const dryRun = Boolean(args.dryRun);
        const rawAction = args.action;
        const actionType = isRecord(rawAction) && typeof rawAction.type === "string" ? rawAction.type : "accion";
        return await store.mutateWorkspace(
          ({ document, nowMs, nowIso }) => {
            const refMap = new Map<string, string>();
            const result = executeSingleAction(document, rawAction, { nowMs, nowIso, refMap });
            return {
              nextDocument: document,
              result,
              undoSummary: `${actionType}`,
            };
          },
          { dryRun, undoSummary: actionType }
        );
      },
    },

    {
      name: "activecard_batch_actions",
      description:
        "Ejecuta hasta 50 acciones en un único commit atómico (todo o nada). Permite encadenar refId mediante $ref:<refId>.",
      inputSchema: {
        type: "object",
        properties: {
          actions: {
            type: "array",
            minItems: 1,
            maxItems: 50,
            items: { type: "object" },
          },
          dryRun: { type: "boolean", default: false },
        },
        required: ["actions"],
        additionalProperties: false,
      },
      handler: async (args) => {
        if (!Array.isArray(args.actions) || args.actions.length === 0 || args.actions.length > 50) {
          throw new Error("actions debe contener entre 1 y 50 operaciones.");
        }
        const dryRun = Boolean(args.dryRun);
        const actions = args.actions;
        return await store.mutateWorkspace(
          ({ document, nowMs, nowIso }) => {
            const refMap = new Map<string, string>();
            const applied = actions.map((action) =>
              executeSingleAction(document, action, { nowMs, nowIso, refMap })
            );
            return {
              nextDocument: document,
              result: {
                count: applied.length,
                refs: Object.fromEntries(refMap.entries()),
                actions: applied,
              },
              undoSummary: `lote (${applied.length} acciones)`,
            };
          },
          { dryRun, undoSummary: `lote (${actions.length} acciones)` }
        );
      },
    },

    {
      name: "activecard_undo_action",
      description:
        "Deshace la última mutación identificada por undoToken si la nube no avanzó desde otro dispositivo.",
      inputSchema: {
        type: "object",
        properties: {
          undoToken: { type: "string" },
        },
        required: ["undoToken"],
        additionalProperties: false,
      },
      handler: async (args) => {
        const token = asOptionalString(args.undoToken)?.trim();
        if (!token) throw new Error("undoToken es obligatorio.");
        return await store.undoAction(token);
      },
    },
  ];
}
