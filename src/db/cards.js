// Repositorio de tarjetas: CRUD + estado FSRS + registro de repasos.

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

export function createCard({ deckId, front, back, source = "manual", originCardId = null }) {
  const db = getDb();
  const s = newCardState();
  const res = db.runSync(
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

export function updateCardText(id, front, back) {
  getDb().runSync("UPDATE cards SET front = ?, back = ? WHERE id = ?", [
    front.trim(),
    back.trim(),
    id,
  ]);
}

export function deleteCard(id) {
  getDb().runSync("DELETE FROM cards WHERE id = ?", [id]);
}

export function getCard(id) {
  return getDb().getFirstSync("SELECT * FROM cards WHERE id = ?", [id]);
}

export function listCardsByDeck(deckId) {
  return getDb().getAllSync(
    "SELECT * FROM cards WHERE deck_id = ? ORDER BY created_at DESC",
    [deckId]
  );
}

export function listAllCards() {
  return getDb().getAllSync("SELECT * FROM cards");
}

export function countDueCards(limitIso) {
  const row = getDb().getFirstSync("SELECT COUNT(*) AS n FROM cards WHERE due <= ?", [limitIso]);
  return row ? row.n : 0;
}

// Califica una tarjeta ('good' | 'again'), persiste el nuevo estado FSRS
// y deja registro en review_logs. mode: 'daily' | 'quizlet'.
export function reviewCard(card, rating, mode, now = new Date()) {
  const db = getDb();
  const next = rate(card, rating, now);
  db.runSync(
    `UPDATE cards SET ${FSRS_COLS.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`,
    [...FSRS_COLS.map((c) => next[c]), card.id]
  );
  db.runSync(
    "INSERT INTO review_logs (card_id, rating, mode, reviewed_at) VALUES (?, ?, ?, ?)",
    [card.id, rating, mode, now.toISOString()]
  );
  return { ...card, ...next };
}
