// Repositorio de conexiones del Gimnasio Mental.

import { getDb } from "./client";

export function saveConnection({ cardId, finalText, transcript, hybridCardId = null }) {
  const res = getDb().runSync(
    `INSERT INTO connections (card_id, final_text, transcript, hybrid_card_id, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [
      cardId,
      finalText,
      transcript ? JSON.stringify(transcript) : null,
      hybridCardId,
      new Date().toISOString(),
    ]
  );
  return res.lastInsertRowId;
}

export function listConnections() {
  return getDb().getAllSync(
    `SELECT co.*, c.front AS card_front, c.deck_id
     FROM connections co JOIN cards c ON c.id = co.card_id
     ORDER BY co.created_at DESC`
  );
}
