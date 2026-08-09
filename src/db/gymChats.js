import { getDb } from "./client";

function parseMetadata(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export async function createGymChat({ originCardId = null, title = "Nueva charla" } = {}) {
  const db = await getDb();
  const now = new Date().toISOString();
  const result = await db.runAsync(
    `INSERT INTO gym_chats (title, origin_card_id, draft_text, created_at, updated_at)
     VALUES (?, ?, '', ?, ?)`,
    [title.trim() || "Nueva charla", originCardId, now, now]
  );
  return result.lastInsertRowId;
}

export async function getGymChat(id) {
  const db = await getDb();
  return db.getFirstAsync(
    `SELECT gc.*, c.front AS origin_front, c.back AS origin_back,
            c.deck_id AS origin_deck_id, d.name AS origin_deck_name
     FROM gym_chats gc
     LEFT JOIN cards c ON c.id = gc.origin_card_id
     LEFT JOIN decks d ON d.id = c.deck_id
     WHERE gc.id = ?`,
    [id]
  );
}

export async function listGymChats() {
  const db = await getDb();
  return db.getAllAsync(
    `SELECT gc.*, c.front AS origin_front, d.name AS origin_deck_name,
            (SELECT text FROM gym_messages gm WHERE gm.chat_id = gc.id
             ORDER BY gm.id DESC LIMIT 1) AS last_message
     FROM gym_chats gc
     LEFT JOIN cards c ON c.id = gc.origin_card_id
     LEFT JOIN decks d ON d.id = c.deck_id
     ORDER BY gc.updated_at DESC, gc.id DESC`
  );
}

export async function deleteGymChat(id) {
  const db = await getDb();
  await db.runAsync("DELETE FROM gym_chats WHERE id = ?", [id]);
}

export async function setGymChatDraft(id, draftText) {
  const db = await getDb();
  await db.runAsync("UPDATE gym_chats SET draft_text = ?, updated_at = ? WHERE id = ?", [
    draftText,
    new Date().toISOString(),
    id,
  ]);
}

export async function renameGymChat(id, title) {
  const db = await getDb();
  await db.runAsync("UPDATE gym_chats SET title = ?, updated_at = ? WHERE id = ?", [
    title.trim() || "Nueva charla",
    new Date().toISOString(),
    id,
  ]);
}

export async function addGymMessage(chatId, role, messageText, metadata = null) {
  const db = await getDb();
  const now = new Date().toISOString();
  const result = await db.runAsync(
    `INSERT INTO gym_messages (chat_id, role, text, metadata, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [chatId, role, messageText, metadata ? JSON.stringify(metadata) : null, now]
  );
  await db.runAsync("UPDATE gym_chats SET updated_at = ? WHERE id = ?", [now, chatId]);
  return result.lastInsertRowId;
}

export async function listGymMessages(chatId) {
  const db = await getDb();
  const rows = await db.getAllAsync(
    `SELECT * FROM gym_messages WHERE chat_id = ? ORDER BY created_at ASC, id ASC`,
    [chatId]
  );
  return rows.map((row) => ({ ...row, metadata: parseMetadata(row.metadata) }));
}

export async function updateGymMessageMetadata(id, metadata) {
  const db = await getDb();
  await db.runAsync("UPDATE gym_messages SET metadata = ? WHERE id = ?", [
    metadata ? JSON.stringify(metadata) : null,
    id,
  ]);
}
