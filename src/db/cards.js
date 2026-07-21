// Repositorio de tarjetas: CRUD + estado FSRS + registro de repasos (async).

import { newCardState, rate } from "../lib/scheduler";
import { getDb } from "./client";

const FSRS_COLS = [
  "due",
  "stability",
  "difficulty",
  "elapsed_days",
  "scheduled_days",
  "reps",
  "lapses",
  "learning_steps",
  "state",
  "last_review",
];

export async function createCard({ deckId, front, back, source = "manual", originCardId = null }) {
  const db = await getDb();
  const s = newCardState();
  const res = await db.runAsync(
    `INSERT INTO cards (deck_id, front, back, source, origin_card_id, created_at,
       due, stability, difficulty, elapsed_days, scheduled_days, reps, lapses,
       learning_steps, state, last_review, starred, position)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0,
       (SELECT COALESCE(MAX(position), 0) + 1 FROM cards WHERE deck_id = ?))`,
    [
      deckId,
      front.trim(),
      back.trim(),
      source,
      originCardId,
      new Date().toISOString(),
      s.due,
      s.stability,
      s.difficulty,
      s.elapsed_days,
      s.scheduled_days,
      s.reps,
      s.lapses,
      s.learning_steps,
      s.state,
      s.last_review,
      deckId,
    ]
  );
  return res.lastInsertRowId;
}

export async function updateCardText(id, front, back) {
  const db = await getDb();
  await db.runAsync("UPDATE cards SET front = ?, back = ? WHERE id = ?", [
    front.trim(),
    back.trim(),
    id,
  ]);
}

export async function deleteCard(id) {
  const db = await getDb();
  await db.runAsync("DELETE FROM cards WHERE id = ?", [id]);
}

export async function getCard(id) {
  const db = await getDb();
  return db.getFirstAsync("SELECT * FROM cards WHERE id = ?", [id]);
}

export async function listCardsByDeck(deckId) {
  const db = await getDb();
  return db.getAllAsync("SELECT * FROM cards WHERE deck_id = ? ORDER BY position ASC, id ASC", [
    deckId,
  ]);
}

// Mazos con al menos una tarjeta-idea (source='hybrid'), con su carpeta,
// cantidad y fecha de la última idea. Base del Gimnasio Mental: se deriva
// en vivo de cards — la idea vive UNA sola vez, en su mazo.
// Orden: sueltos primero, después con carpeta; alfabético dentro de cada grupo.
export async function listDecksWithIdeas() {
  const db = await getDb();
  return db.getAllAsync(
    `SELECT d.id, d.name, d.icon, d.folder_id,
            COUNT(c.id) AS idea_count,
            MAX(c.created_at) AS last_idea_at
     FROM cards c JOIN decks d ON d.id = c.deck_id
     WHERE c.source = 'hybrid'
     GROUP BY d.id
     ORDER BY (d.folder_id IS NOT NULL), d.name COLLATE NOCASE`
  );
}

// Tarjetas-idea de un mazo, la más reciente primero.
export async function listIdeaCards(deckId) {
  const db = await getDb();
  return db.getAllAsync(
    `SELECT * FROM cards WHERE deck_id = ? AND source = 'hybrid'
     ORDER BY created_at DESC, id DESC`,
    [deckId]
  );
}

// Marca/desmarca la estrella (starred: 0 | 1).
export async function setCardStarred(id, starred) {
  const db = await getDb();
  await db.runAsync("UPDATE cards SET starred = ? WHERE id = ?", [starred, id]);
}

// Persiste el orden manual: position = índice + 1 según orderedIds.
export async function setCardPositions(deckId, orderedIds) {
  const db = await getDb();
  await db.execAsync("BEGIN");
  try {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.runAsync("UPDATE cards SET position = ? WHERE id = ? AND deck_id = ?", [
        i + 1,
        orderedIds[i],
        deckId,
      ]);
    }
    await db.execAsync("COMMIT");
  } catch (e) {
    await db.execAsync("ROLLBACK");
    throw e;
  }
}

export async function listAllCards() {
  const db = await getDb();
  return db.getAllAsync("SELECT * FROM cards");
}

// Tarjetas distintas repasadas desde un instante dado. mode null = cualquier
// modo (estudiar un mazo también avanza la misma FSRS que el repaso diario).
export async function countDistinctReviewedSince(mode, sinceIso) {
  const db = await getDb();
  const row = mode
    ? await db.getFirstAsync(
        "SELECT COUNT(DISTINCT card_id) AS n FROM review_logs WHERE mode = ? AND reviewed_at >= ?",
        [mode, sinceIso]
      )
    : await db.getFirstAsync(
        "SELECT COUNT(DISTINCT card_id) AS n FROM review_logs WHERE reviewed_at >= ?",
        [sinceIso]
      );
  return row ? row.n : 0;
}

// Tarjetas cuya ÚLTIMA calificación desde `sinceIso` fue "again" (cualquier
// modo): falladas del día que siguen pendientes hasta que se acierten.
export async function listRetryTodayIds(sinceIso) {
  const db = await getDb();
  const rows = await db.getAllAsync(
    `SELECT card_id FROM review_logs rl
     WHERE rl.reviewed_at >= ? AND rl.rating = 'again'
       AND rl.id = (SELECT MAX(id) FROM review_logs WHERE card_id = rl.card_id AND reviewed_at >= ?)`,
    [sinceIso, sinceIso]
  );
  return rows.map((r) => r.card_id);
}

export async function countDueCards(limitIso) {
  const db = await getDb();
  const row = await db.getFirstAsync("SELECT COUNT(*) AS n FROM cards WHERE due <= ?", [
    limitIso,
  ]);
  return row ? row.n : 0;
}

// Califica una tarjeta ('good' | 'again'), persiste el nuevo estado FSRS
// y deja registro en review_logs. mode: 'daily' | 'quizlet'.
export async function reviewCard(card, rating, mode, now = new Date()) {
  const db = await getDb();
  const next = rate(card, rating, now);
  await db.runAsync(
    `UPDATE cards SET ${FSRS_COLS.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`,
    [...FSRS_COLS.map((c) => next[c]), card.id]
  );
  const logRes = await db.runAsync(
    "INSERT INTO review_logs (card_id, rating, mode, reviewed_at) VALUES (?, ?, ?, ?)",
    [card.id, rating, mode, now.toISOString()]
  );
  return { ...card, ...next, logId: logRes.lastInsertRowId };
}

// Snapshot del estado FSRS de una tarjeta, para poder restaurarlo con undoReview.
export function snapshotFsrs(card) {
  return Object.fromEntries(FSRS_COLS.map((c) => [c, card[c]]));
}

// Revierte una calificación: restaura el estado FSRS previo y borra el
// review_log correspondiente. Las conexiones del Gimnasio Mental y sus
// tarjetas híbridas NUNCA se tocan acá.
export async function undoReview(cardId, prevFields, logId) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE cards SET ${FSRS_COLS.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`,
    [...FSRS_COLS.map((c) => prevFields[c]), cardId]
  );
  await db.runAsync("DELETE FROM review_logs WHERE id = ?", [logId]);
}
