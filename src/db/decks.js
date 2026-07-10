// Repositorio de mazos y etiquetas.

import { getDb } from "./client";

export function listDecks() {
  const db = getDb();
  const decks = db.getAllSync(
    `SELECT d.*, COUNT(c.id) AS card_count
     FROM decks d LEFT JOIN cards c ON c.deck_id = d.id
     GROUP BY d.id ORDER BY d.name COLLATE NOCASE`
  );
  const tagRows = db.getAllSync(
    `SELECT dt.deck_id, t.id, t.name FROM deck_tags dt JOIN tags t ON t.id = dt.tag_id`
  );
  const tagsByDeck = {};
  for (const r of tagRows) {
    (tagsByDeck[r.deck_id] = tagsByDeck[r.deck_id] || []).push({ id: r.id, name: r.name });
  }
  return decks.map((d) => ({ ...d, tags: tagsByDeck[d.id] || [] }));
}

export function getDeck(id) {
  const db = getDb();
  const deck = db.getFirstSync("SELECT * FROM decks WHERE id = ?", [id]);
  if (!deck) return null;
  const tags = db.getAllSync(
    `SELECT t.* FROM deck_tags dt JOIN tags t ON t.id = dt.tag_id WHERE dt.deck_id = ?`,
    [id]
  );
  return { ...deck, tags };
}

export function createDeck(name) {
  const db = getDb();
  const res = db.runSync("INSERT INTO decks (name, created_at) VALUES (?, ?)", [
    name.trim(),
    new Date().toISOString(),
  ]);
  return res.lastInsertRowId;
}

export function renameDeck(id, name) {
  getDb().runSync("UPDATE decks SET name = ? WHERE id = ?", [name.trim(), id]);
}

export function deleteDeck(id) {
  getDb().runSync("DELETE FROM decks WHERE id = ?", [id]);
}

// --- Etiquetas ---

export function listTags() {
  return getDb().getAllSync("SELECT * FROM tags ORDER BY name COLLATE NOCASE");
}

// Devuelve el id de la etiqueta, creándola si no existe.
export function ensureTag(name) {
  const db = getDb();
  const clean = name.trim();
  const existing = db.getFirstSync("SELECT id FROM tags WHERE name = ? COLLATE NOCASE", [clean]);
  if (existing) return existing.id;
  return db.runSync("INSERT INTO tags (name) VALUES (?)", [clean]).lastInsertRowId;
}

export function setDeckTags(deckId, tagIds) {
  const db = getDb();
  db.runSync("DELETE FROM deck_tags WHERE deck_id = ?", [deckId]);
  for (const tagId of tagIds) {
    db.runSync("INSERT OR IGNORE INTO deck_tags (deck_id, tag_id) VALUES (?, ?)", [deckId, tagId]);
  }
}

export function deleteTag(id) {
  getDb().runSync("DELETE FROM tags WHERE id = ?", [id]);
}

// Mapa { deckId: [tagId, ...] } para la lógica de prioridades de la cola.
export function getDeckTagsMap() {
  const rows = getDb().getAllSync("SELECT deck_id, tag_id FROM deck_tags");
  const map = {};
  for (const r of rows) {
    (map[r.deck_id] = map[r.deck_id] || []).push(r.tag_id);
  }
  return map;
}
