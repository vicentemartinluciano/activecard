// Repositorio de mazos y etiquetas (API asíncrona).

import { getDb } from "./client";

export async function listDecks() {
  const db = await getDb();
  const decks = await db.getAllAsync(
    `SELECT d.*, COUNT(c.id) AS card_count
     FROM decks d LEFT JOIN cards c ON c.deck_id = d.id
     GROUP BY d.id ORDER BY d.name COLLATE NOCASE`
  );
  const tagRows = await db.getAllAsync(
    `SELECT dt.deck_id, t.id, t.name FROM deck_tags dt JOIN tags t ON t.id = dt.tag_id`
  );
  const tagsByDeck = {};
  for (const r of tagRows) {
    (tagsByDeck[r.deck_id] = tagsByDeck[r.deck_id] || []).push({ id: r.id, name: r.name });
  }
  return decks.map((d) => ({ ...d, tags: tagsByDeck[d.id] || [] }));
}

export async function getDeck(id) {
  const db = await getDb();
  const deck = await db.getFirstAsync("SELECT * FROM decks WHERE id = ?", [id]);
  if (!deck) return null;
  const tags = await db.getAllAsync(
    `SELECT t.* FROM deck_tags dt JOIN tags t ON t.id = dt.tag_id WHERE dt.deck_id = ?`,
    [id]
  );
  return { ...deck, tags };
}

export async function createDeck(name) {
  const db = await getDb();
  const res = await db.runAsync("INSERT INTO decks (name, created_at) VALUES (?, ?)", [
    name.trim(),
    new Date().toISOString(),
  ]);
  return res.lastInsertRowId;
}

export async function renameDeck(id, name) {
  const db = await getDb();
  await db.runAsync("UPDATE decks SET name = ? WHERE id = ?", [name.trim(), id]);
}

// Prioridad porcentual del mazo (0-100, pasos de 5). 0 = pausado.
export async function updateDeckPriority(id, priority) {
  const db = await getDb();
  const clamped = Math.max(0, Math.min(100, Math.round(priority / 5) * 5));
  await db.runAsync("UPDATE decks SET priority = ? WHERE id = ?", [clamped, id]);
}

// Ícono del mazo (nombre de ícono Feather) o null.
export async function updateDeckIcon(id, icon) {
  const db = await getDb();
  await db.runAsync("UPDATE decks SET icon = ? WHERE id = ?", [icon || null, id]);
}

// Carpeta del mazo (folders.id) o null para dejarlo suelto.
export async function setDeckFolder(deckId, folderId) {
  const db = await getDb();
  await db.runAsync("UPDATE decks SET folder_id = ? WHERE id = ?", [folderId || null, deckId]);
}

// Mapa { deckId: prioridad } para armar la cola diaria.
export async function getDeckPriorities() {
  const db = await getDb();
  const rows = await db.getAllAsync("SELECT id, priority FROM decks");
  const map = {};
  for (const r of rows) map[r.id] = r.priority;
  return map;
}

export async function deleteDeck(id) {
  const db = await getDb();
  await db.runAsync("DELETE FROM decks WHERE id = ?", [id]);
}

// --- Etiquetas ---

export async function listTags() {
  const db = await getDb();
  return db.getAllAsync("SELECT * FROM tags ORDER BY name COLLATE NOCASE");
}

// Devuelve el id de la etiqueta, creándola si no existe.
export async function ensureTag(name) {
  const db = await getDb();
  const clean = name.trim();
  const existing = await db.getFirstAsync(
    "SELECT id FROM tags WHERE name = ? COLLATE NOCASE",
    [clean]
  );
  if (existing) return existing.id;
  const res = await db.runAsync("INSERT INTO tags (name) VALUES (?)", [clean]);
  return res.lastInsertRowId;
}

export async function setDeckTags(deckId, tagIds) {
  const db = await getDb();
  await db.runAsync("DELETE FROM deck_tags WHERE deck_id = ?", [deckId]);
  for (const tagId of tagIds) {
    await db.runAsync("INSERT OR IGNORE INTO deck_tags (deck_id, tag_id) VALUES (?, ?)", [
      deckId,
      tagId,
    ]);
  }
}

export async function deleteTag(id) {
  const db = await getDb();
  await db.runAsync("DELETE FROM tags WHERE id = ?", [id]);
}

// Mapa { deckId: [tagId, ...] } para la lógica de prioridades de la cola.
export async function getDeckTagsMap() {
  const db = await getDb();
  const rows = await db.getAllAsync("SELECT deck_id, tag_id FROM deck_tags");
  const map = {};
  for (const r of rows) {
    (map[r.deck_id] = map[r.deck_id] || []).push(r.tag_id);
  }
  return map;
}
