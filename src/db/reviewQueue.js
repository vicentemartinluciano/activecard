// Compone los repos con la lógica pura de src/lib/queue.js
// para armar la cola de repaso del día. Async.

import { buildDailyQueue, endOfDay, monthKey } from "../lib/queue";
import { listAllCards, countDueCards } from "./cards";
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
