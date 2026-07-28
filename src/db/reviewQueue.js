// Compone los repos con la lógica pura de src/lib/queue.js
// para armar la cola de repaso del día. Async.

import { buildDailyQueue, endOfDay, startOfDay } from "../lib/queue";
import {
  countDistinctReviewedSince,
  countDueCards,
  listAllCards,
  listRetryTodayIds,
} from "./cards";
import { getDeckPriorities } from "./decks";
import { getSetting } from "./settings";

// Topes por defecto: valores de arranque, ajustables desde Ajustes.
export const DEFAULT_LIMITS = { maxReviews: 40, maxNew: 15 };

export function getDailyLimits() {
  return getSetting("dailyLimits", DEFAULT_LIMITS);
}

// La cola del día incluye las FALLADAS de hoy (última nota = again): FSRS las
// reprograma para mañana, pero siguen pendientes hasta que las aciertes.
// Al final se recorta a los topes diarios: lo que sobra pasa a mañana.
export async function getDailyQueue(now = new Date()) {
  const [cards, deckPriorities, retryIds, limits] = await Promise.all([
    listAllCards(),
    getDeckPriorities(),
    listRetryTodayIds(startOfDay(now).toISOString()),
    getDailyLimits(),
  ]);
  return buildDailyQueue(cards, { deckPriorities, now, retryIds, limits });
}

// Cantidad de tarjetas pendientes hoy en mazos activos (debidas + falladas).
export async function getDueCount(now = new Date()) {
  const queue = await getDailyQueue(now);
  return queue.length;
}

// Estado del repaso diario para la barra de Inicio:
// hechas hoy (CUALQUIER modo: estudiar un mazo reprograma las mismas tarjetas
// que el repaso diario, así que también cuenta) + pendientes = total del día.
// Las falladas pendientes NO cuentan como hechas — fallar no es avanzar.
export async function getDailyReviewStats(now = new Date()) {
  const startIso = startOfDay(now).toISOString();
  const [reviewed, retryIds, remaining] = await Promise.all([
    countDistinctReviewedSince(null, startIso),
    listRetryTodayIds(startIso),
    getDueCount(now),
  ]);
  const done = Math.max(0, reviewed - retryIds.length);
  const total = done + remaining;
  return {
    done,
    remaining,
    total,
    pct: total > 0 ? Math.round((done / total) * 100) : 0,
  };
}

export { countDueCards, endOfDay };
