// Repositorio de conexiones del Gimnasio Mental (async).

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

export async function listConnections(deckId = null) {
  const db = await getDb();
  if (deckId != null) {
    return db.getAllAsync(
      `SELECT co.*, c.front AS card_front, c.deck_id
       FROM connections co JOIN cards c ON c.id = co.card_id
       WHERE c.deck_id = ?
       ORDER BY co.created_at DESC`,
      [deckId]
    );
  }
  return db.getAllAsync(
    `SELECT co.*, c.front AS card_front, c.deck_id
     FROM connections co JOIN cards c ON c.id = co.card_id
     ORDER BY co.created_at DESC`
  );
}

// Mazos que tienen al menos una conexión validada del Gimnasio Mental,
// ordenados por la conexión más reciente. Base de la carpeta virtual
// "Gimnasio Mental" en la Biblioteca.
export async function listDecksWithConnections() {
  const db = await getDb();
  return db.getAllAsync(
    `SELECT d.id, d.name, d.icon,
            COUNT(co.id) AS connection_count,
            MAX(co.created_at) AS last_connection_at
     FROM connections co
     JOIN cards c ON c.id = co.card_id
     JOIN decks d ON d.id = c.deck_id
     GROUP BY d.id
     ORDER BY last_connection_at DESC`
  );
}
