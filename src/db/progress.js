// Progreso diario de estudio (modo Quizlet/mazo) por mazo.
// Derivado de review_logs: no hay estado propio, se reinicia solo al
// cambiar el día porque "hoy" se recalcula en cada consulta.

import { startOfDay } from "../lib/queue";
import { getDb } from "./client";

export async function getDeckDailyProgress(deckId, now = new Date()) {
  const db = await getDb();
  const sinceIso = startOfDay(now).toISOString();
  const [totalRow, doneRow] = await Promise.all([
    db.getFirstAsync("SELECT COUNT(*) AS n FROM cards WHERE deck_id = ?", [deckId]),
    db.getFirstAsync(
      `SELECT COUNT(DISTINCT card_id) AS n FROM review_logs
       WHERE mode = 'quizlet' AND reviewed_at >= ?
         AND card_id IN (SELECT id FROM cards WHERE deck_id = ?)`,
      [sinceIso, deckId]
    ),
  ]);
  const total = totalRow ? totalRow.n : 0;
  const reviewedToday = doneRow ? doneRow.n : 0;
  return {
    reviewedToday,
    total,
    pct: total > 0 ? Math.round((reviewedToday / total) * 100) : 0,
  };
}

// Versión batch para la Biblioteca: un progreso por mazo en dos queries.
export async function getDecksDailyProgress(now = new Date()) {
  const db = await getDb();
  const sinceIso = startOfDay(now).toISOString();
  const [totals, doneRows] = await Promise.all([
    db.getAllAsync("SELECT deck_id, COUNT(*) AS n FROM cards GROUP BY deck_id"),
    db.getAllAsync(
      `SELECT c.deck_id AS deck_id, COUNT(DISTINCT rl.card_id) AS n
       FROM review_logs rl JOIN cards c ON c.id = rl.card_id
       WHERE rl.mode = 'quizlet' AND rl.reviewed_at >= ?
       GROUP BY c.deck_id`,
      [sinceIso]
    ),
  ]);
  const totalByDeck = Object.fromEntries(totals.map((r) => [r.deck_id, r.n]));
  const doneByDeck = Object.fromEntries(doneRows.map((r) => [r.deck_id, r.n]));
  const map = {};
  for (const deckId of Object.keys(totalByDeck)) {
    const total = totalByDeck[deckId];
    const reviewedToday = doneByDeck[deckId] || 0;
    map[deckId] = {
      reviewedToday,
      total,
      pct: total > 0 ? Math.round((reviewedToday / total) * 100) : 0,
    };
  }
  return map;
}

// Tarjetas del mazo que todavía NO se repasaron hoy en modo Quizlet.
export async function listDeckCardsNotReviewedToday(deckId, now = new Date()) {
  const db = await getDb();
  const sinceIso = startOfDay(now).toISOString();
  return db.getAllAsync(
    `SELECT * FROM cards WHERE deck_id = ? AND id NOT IN (
       SELECT card_id FROM review_logs WHERE mode = 'quizlet' AND reviewed_at >= ?
     )`,
    [deckId, sinceIso]
  );
}
