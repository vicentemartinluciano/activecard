// Compone los repos con la lógica pura de src/lib/queue.js
// para armar la cola de repaso del día. Async.

import { buildDailyQueue, endOfDay, monthKey, startOfDay } from "../lib/queue";
import { countDistinctReviewedSince, countDueCards, listAllCards } from "./cards";
import { getDeckTagsMap } from "./decks";
import { listPriorities } from "./priorities";
import { getFocusDeckIds } from "./settings";

export async function getDailyQueue(now = new Date()) {
  const [cards, priorities, deckTags, focusDeckIds] = await Promise.all([
    listAllCards(),
    listPriorities(monthKey(now)),
    getDeckTagsMap(),
    getFocusDeckIds(),
  ]);
  return buildDailyQueue(cards, { priorities, deckTags, focusDeckIds, now });
}

// Cantidad de tarjetas debidas hoy (para el "Repasar (N)" de la Home).
export function getDueCount(now = new Date()) {
  return countDueCards(endOfDay(now).toISOString());
}

// Estado del repaso diario para la barra de Inicio:
// hechas hoy (modo daily) + pendientes = total del día.
export async function getDailyReviewStats(now = new Date()) {
  const [done, remaining] = await Promise.all([
    countDistinctReviewedSince("daily", startOfDay(now).toISOString()),
    countDueCards(endOfDay(now).toISOString()),
  ]);
  const total = done + remaining;
  return {
    done,
    remaining,
    total,
    pct: total > 0 ? Math.round((done / total) * 100) : 0,
  };
}
