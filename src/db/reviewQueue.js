// Compone los repos con la lógica pura de src/lib/queue.js
// para armar la cola de repaso del día. Async.

import { buildDailyQueue, endOfDay, startOfDay } from "../lib/queue";
import { countDistinctReviewedSince, countDueCards, listAllCards } from "./cards";
import { getDeckPriorities } from "./decks";

export async function getDailyQueue(now = new Date()) {
  const [cards, deckPriorities] = await Promise.all([listAllCards(), getDeckPriorities()]);
  return buildDailyQueue(cards, { deckPriorities, now });
}

// Cantidad de tarjetas debidas hoy en mazos activos (para el "Repasar (N)").
export async function getDueCount(now = new Date()) {
  const queue = await getDailyQueue(now);
  return queue.length;
}

// Estado del repaso diario para la barra de Inicio:
// hechas hoy (CUALQUIER modo: estudiar un mazo reprograma las mismas tarjetas
// que el repaso diario, así que también cuenta) + pendientes = total del día.
export async function getDailyReviewStats(now = new Date()) {
  const [done, remaining] = await Promise.all([
    countDistinctReviewedSince(null, startOfDay(now).toISOString()),
    getDueCount(now),
  ]);
  const total = done + remaining;
  return {
    done,
    remaining,
    total,
    pct: total > 0 ? Math.round((done / total) * 100) : 0,
  };
}

export { countDueCards, endOfDay };
