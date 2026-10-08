import { FSRS_COLS } from "../db/cards";

export const COLUMNS = {
  folders: ["name", "created_at"],
  decks: ["name", "created_at", "priority", "icon", "folder_id"],
  tags: ["name"],
  cards: ["deck_id", "front", "back", "source", "origin_card_id", "created_at", ...FSRS_COLS, "starred", "position", "suspended"],
  review_logs: ["card_id", "rating", "mode", "reviewed_at"],
  connections: ["card_id", "final_text", "transcript", "hybrid_card_id", "created_at"],
  gym_chats: ["title", "origin_card_id", "draft_text", "created_at", "updated_at"],
  gym_messages: ["chat_id", "role", "text", "metadata", "created_at"],
};
export const REFERENCES = {
  deck_id: "decks", folder_id: "folders", tag_id: "tags", card_id: "cards",
  origin_card_id: "cards", hybrid_card_id: "cards", chat_id: "gym_chats",
};
const REQUIRED = new Set(["deck_id", "card_id", "chat_id"]);
const NUMBERS = new Set([...FSRS_COLS.filter((c) => !["due", "last_review"].includes(c)), "priority", "position", "starred", "suspended"]);
const NULLABLE = new Set(["folder_id", "origin_card_id", "hybrid_card_id", "last_review", "icon", "position", "transcript", "metadata"]);
export const canonical = (value) => JSON.stringify(value, (_, item) => {
  if (item && typeof item === "object" && !Array.isArray(item)) return Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]]));
  return item;
});
export const same = (a, b) => canonical(a) === canonical(b);
export function emptyDocument() {
  return { schema: 1, ...Object.fromEntries(Object.keys(COLUMNS).map((table) => [table, {}])), deck_tags: [] };
}
const metadataRefs = {
  cardId: "cards", selectedCardId: "cards", createdCardId: "cards", originCardId: "cards",
  deckId: "decks", createdDeckId: "decks", folderId: "folders", createdFolderId: "folders",
  createdCardIds: "cards", deleteDeckIds: "decks", selectedCardIds: "cards",
};
export function mapMetadata(value, maps) {
  if (!value) return null;
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  const walk = (item) => {
    if (Array.isArray(item)) return item.map(walk);
    if (!item || typeof item !== "object") return item;
    return Object.fromEntries(Object.entries(item).map(([key, content]) => {
      const target = metadataRefs[key] || REFERENCES[key];
      if (!target) return [key, walk(content)];
      const map = maps[target];
      return [key, Array.isArray(content) ? content.map((id) => map.get(id)).filter((id) => id != null) : map.get(content) ?? null];
    }));
  };
  const result = walk(parsed);
  if (parsed?.action) {
    const action = result.action;
    const table = /folder/.test(action.type) ? "folders" : /deck/.test(action.type) ? "decks" : "cards";
    if (action.before?.id != null) action.before.id = maps[table].get(parsed.action.before.id) ?? null;
    if (Array.isArray(action.decks)) action.decks = action.decks.map((deck, index) => ({ ...deck, id: maps.decks.get(parsed.action.decks[index].id) ?? null })).filter((deck) => deck.id != null);
  }
  return JSON.stringify(result);
}
export function documentFromBackup(backup) {
  const doc = emptyDocument();
  const maps = {};
  for (const table of Object.keys(COLUMNS)) {
    maps[table] = new Map((backup[table] || []).map((row) => [row.id, table === "tags" ? `tag:${row.name}` : row.sync_id || `legacy:${table}:${row.id}:${row.reviewed_at || row.created_at || row.name}`]));
  }
  for (const [table, columns] of Object.entries(COLUMNS)) {
    for (const row of backup[table] || []) {
      const next = {};
      for (const column of columns) {
        next[column] = REFERENCES[column] ? maps[REFERENCES[column]].get(row[column]) ?? null : row[column] ?? null;
      }
      if (table === "gym_messages") next.metadata = mapMetadata(row.metadata, maps);
      doc[table][maps[table].get(row.id)] = next;
    }
  }
  doc.deck_tags = (backup.deck_tags || []).map((link) => [maps.decks.get(link.deck_id), maps.tags.get(link.tag_id)]).sort((a, b) => canonical(a).localeCompare(canonical(b)));
  validateDocument(doc);
  return doc;
}
export function validateDocument(doc) {
  const fail = () => { throw new Error("El contenido de sincronización no es válido. Tus datos locales siguen conservados."); };
  if (!doc || doc.schema !== 1 || Object.keys(doc).sort().join() !== Object.keys(emptyDocument()).sort().join()) fail();
  for (const [table, columns] of Object.entries(COLUMNS)) {
    const rows = doc[table];
    if (!rows || typeof rows !== "object" || Array.isArray(rows) || Object.keys(rows).length > 100000) fail();
    for (const [id, row] of Object.entries(rows)) {
      if (!id || id.length > 512 || ["__proto__", "constructor", "prototype"].includes(id) || !row || Object.keys(row).sort().join() !== [...columns].sort().join()) fail();
      for (const column of columns) {
        const value = row[column];
        if (value === null && NULLABLE.has(column)) continue;
        if (REFERENCES[column]) {
          if (typeof value !== "string" || !Object.hasOwn(doc[REFERENCES[column]], value)) fail();
        } else if (NUMBERS.has(column)) {
          if (typeof value !== "number" || !Number.isFinite(value) || value < 0) fail();
        } else if (typeof value !== "string") fail();
      }
      for (const column of ["created_at", "updated_at", "reviewed_at", "due", "last_review"].filter((c) => columns.includes(c))) {
        if (row[column] !== null && !Number.isFinite(Date.parse(row[column]))) fail();
      }
      if (table === "cards" && (!["manual", "ai", "hybrid"].includes(row.source) || ![0, 1].includes(row.starred) || ![0, 1].includes(row.suspended) || ![0, 1, 2, 3].includes(row.state))) fail();
      if (table === "review_logs" && (!["again", "hard", "good"].includes(row.rating) || !["daily", "quizlet"].includes(row.mode))) fail();
      if (table === "gym_messages") {
        if (!["user", "assistant", "system"].includes(row.role)) fail();
        if (row.metadata) { try { JSON.parse(row.metadata); } catch { fail(); } }
      }
    }
  }
  if (!Array.isArray(doc.deck_tags)) fail();
  const links = new Set();
  for (const pair of doc.deck_tags) {
    if (!Array.isArray(pair) || pair.length !== 2 || !Object.hasOwn(doc.decks, pair[0]) || !Object.hasOwn(doc.tags, pair[1]) || links.has(canonical(pair))) fail();
    links.add(canonical(pair));
  }
  return doc;
}
// Programación e historial forman una unidad: nunca se mezclan estados FSRS
// calculados desde dos puntos distintos. La alternativa queda en recuperación.
function units(doc) {
  const result = {};
  const grouped = (rows, column) => {
    const groups = {};
    for (const [id, child] of Object.entries(rows)) (groups[child[column]] ||= {})[id] = child;
    return groups;
  };
  const reviews = grouped(doc.review_logs, "card_id");
  const connections = grouped(doc.connections, "card_id");
  const messages = grouped(doc.gym_messages, "chat_id");
  const links = {};
  for (const link of doc.deck_tags) (links[link[0]] ||= []).push(link);
  for (const table of ["folders", "decks", "tags", "cards", "gym_chats"]) {
    for (const [id, row] of Object.entries(doc[table])) {
      const unit = { row };
      if (table === "decks") unit.links = links[id] || [];
      if (table === "cards") {
        unit.reviews = reviews[id] || {};
        unit.connections = connections[id] || {};
      }
      if (table === "gym_chats") unit.messages = messages[id] || {};
      result[JSON.stringify([table, id])] = unit;
    }
  }
  return result;
}
export function mergeDocuments(base, local, remote) {
  [base, local, remote].forEach(validateDocument);
  const [b, l, r] = [base, local, remote].map(units);
  const result = emptyDocument();
  const conflicts = [];
  for (const key of new Set([...Object.keys(b), ...Object.keys(l), ...Object.keys(r)])) {
    let chosen;
    if (same(l[key], r[key]) || same(l[key], b[key])) chosen = r[key];
    else if (same(r[key], b[key])) chosen = l[key];
    else { conflicts.push(key); chosen = r[key]; }
    if (!chosen) continue;
    const [table, id] = JSON.parse(key);
    result[table][id] = chosen.row;
    if (chosen.links) result.deck_tags.push(...chosen.links);
    Object.assign(result.review_logs, chosen.reviews);
    Object.assign(result.connections, chosen.connections);
    Object.assign(result.gym_messages, chosen.messages);
  }
  // Un borrado de padre concurrente con una edición de hijo también se archiva.
  for (const [table, rows] of Object.entries(result).filter(([name]) => COLUMNS[name])) {
    for (const [id, original] of Object.entries(rows)) {
      const row = { ...original };
      for (const [column, target] of Object.entries(REFERENCES)) {
        if (row[column] == null || Object.hasOwn(result[target], row[column])) continue;
        conflicts.push(`${table}\n${id}`);
        if (REQUIRED.has(column)) { delete rows[id]; break; }
        row[column] = null;
      }
      if (rows[id]) rows[id] = row;
    }
  }
  // Cerrar referencias después de todos los borrados, también entre tarjetas.
  let changed;
  do {
    changed = false;
    for (const table of Object.keys(COLUMNS)) {
      for (const [id, original] of Object.entries(result[table])) {
        const row = { ...original };
        for (const [column, target] of Object.entries(REFERENCES)) {
          if (row[column] == null || Object.hasOwn(result[target], row[column])) continue;
          conflicts.push(`${table}\n${id}`); changed = true;
          if (REQUIRED.has(column)) { delete result[table][id]; break; }
          row[column] = null;
        }
        if (result[table][id]) result[table][id] = row;
      }
    }
  } while (changed);
  result.deck_tags = result.deck_tags.filter(([deck, tag]) => Object.hasOwn(result.decks, deck) && Object.hasOwn(result.tags, tag)).sort((a, b) => canonical(a).localeCompare(canonical(b)));
  validateDocument(result);
  return { document: result, conflicts: [...new Set(conflicts)] };
}
