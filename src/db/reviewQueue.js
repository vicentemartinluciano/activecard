// Compone los repos con la lógica pura de src/lib/queue.js
// para armar la cola de repaso del día.

import { buildDailyQueue, endOfDay, monthKey } from "../lib/queue";
import { listAllCards, countDueCards } from "./cards";
import { getDeckTagsMap } from "./decks";
import { listPriorities } from "./priorities";
import { getFocusDeckIds } from "./settings";

export function getDailyQueue(now = new Date()) {
  return buildDailyQueue(listAllCards(), {
    priorities: listPriorities(monthKey(now)),
    deckTags: getDeckTagsMap(),
    focusDeckIds: getFocusDeckIds(),
    now,
  });
}

// Cantidad de tarjetas debidas hoy (para el "Repasar (N)" de la Home).
export function getDueCount(now = new Date()) {
  return countDueCards(endOfDay(now).toISOString());
}
