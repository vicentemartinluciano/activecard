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
       learning_steps, state, last_review)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
  return db.getAllAsync("SELECT * FROM cards WHERE deck_id = ? ORDER BY created_at DESC", [
    deckId,
  ]);
}

export async function listAllCards() {
  const db = await getDb();
  return db.getAllAsync("SELECT * FROM cards");
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
  await db.runAsync(
    "INSERT INTO review_logs (card_id, rating, mode, reviewed_at) VALUES (?, ?, ?, ?)",
    [card.id, rating, mode, now.toISOString()]
  );
  return { ...card, ...next };
}
