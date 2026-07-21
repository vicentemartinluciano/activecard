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
