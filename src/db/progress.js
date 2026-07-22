// Progreso diario de estudio (modo Quizlet/mazo) por mazo.
// Derivado de review_logs: no hay estado propio, se reinicia solo al
// cambiar el día porque "hoy" se recalcula en cada consulta.
// Fallar NO es avanzar (F70): una tarjeta cuenta como "hecha hoy" solo si su
// ÚLTIMA nota quizlet del día NO es 'again' — o sea 'good' o 'hard' ("Más o
// menos", que avanza). Las falladas siguen pendientes y re-entran al pool de
// estudio hasta que se aciertan (con 'good' o 'hard').

import { startOfDay } from "../lib/queue";
import { getDb } from "./client";

// Subquery reutilizada: tarjetas cuya última calificación quizlet de hoy NO fue
// 'again' (las "hechas" del día). Toma DOS parámetros iguales (sinceIso x2).
const DONE_TODAY_SQL = `
  SELECT rl.card_id FROM review_logs rl
  WHERE rl.mode = 'quizlet' AND rl.reviewed_at >= ? AND rl.rating != 'again'
    AND rl.id = (SELECT MAX(id) FROM review_logs
                 WHERE card_id = rl.card_id AND mode = 'quizlet' AND reviewed_at >= ?)
`;

export async function getDeckDailyProgress(deckId, now = new Date()) {
  const db = await getDb();
  const sinceIso = startOfDay(now).toISOString();
  const [totalRow, doneRow] = await Promise.all([
    db.getFirstAsync("SELECT COUNT(*) AS n FROM cards WHERE deck_id = ?", [deckId]),
    db.getFirstAsync(
      `SELECT COUNT(*) AS n FROM (${DONE_TODAY_SQL})
       WHERE card_id IN (SELECT id FROM cards WHERE deck_id = ?)`,
      [sinceIso, sinceIso, deckId]
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
      `SELECT c.deck_id AS deck_id, COUNT(*) AS n
       FROM (${DONE_TODAY_SQL}) done JOIN cards c ON c.id = done.card_id
       GROUP BY c.deck_id`,
      [sinceIso, sinceIso]
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

// Tarjetas del mazo que todavía NO quedaron "hechas" hoy en modo Quizlet:
// las nunca repasadas hoy Y las falladas (última nota del día = again).
export async function listDeckCardsNotReviewedToday(deckId, now = new Date()) {
  const db = await getDb();
  const sinceIso = startOfDay(now).toISOString();
  return db.getAllAsync(
    `SELECT * FROM cards WHERE deck_id = ? AND id NOT IN (${DONE_TODAY_SQL})`,
    [deckId, sinceIso, sinceIso]
  );
}
