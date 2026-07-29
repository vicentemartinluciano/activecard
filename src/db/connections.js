// Registro interno de las charlas del Gimnasio Mental (transcript + síntesis
// final). La UI ya NO lee de acá: las ideas se derivan en vivo de las tarjetas
// con source='hybrid' (ver listDecksWithIdeas/listIdeaCards en db/cards.js).
// Esta tabla queda como bitácora y viaja en el respaldo.

import { getDb } from "./client";

export async function saveConnection({ cardId, finalText, transcript, hybridCardId = null }) {
  const db = await getDb();
  const res = await db.runAsync(
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

export async function listConnectionsByHybridCard(hybridCardId) {
  const db = await getDb();
  const rows = await db.getAllAsync(
    `SELECT cn.*, origin.deck_id AS origin_deck_id,
            origin.front AS origin_front, origin.back AS origin_back,
            d.name AS origin_deck_name
     FROM connections cn
     LEFT JOIN cards origin ON origin.id = cn.card_id
     LEFT JOIN decks d ON d.id = origin.deck_id
     WHERE cn.hybrid_card_id = ?
     ORDER BY cn.created_at DESC, cn.id DESC`,
    [hybridCardId]
  );
  return rows.map((row) => {
    if (!row.transcript) return { ...row, transcript: [] };
    try {
      const transcript = JSON.parse(row.transcript);
      return { ...row, transcript: Array.isArray(transcript) ? transcript : [] };
    } catch {
      return { ...row, transcript: [] };
    }
  });
}
