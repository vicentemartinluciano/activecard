// Compone los repos con la lógica pura de src/lib/queue.js
// para armar la cola de repaso del día. Async.

import { buildDailyQueue, endOfDay, startOfDay } from "../lib/queue";
import {
  countDistinctReviewedSince,
  countDueCards,
  countNewIntroducedSince,
  listAllCards,
  listCardsForQueue,
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
//
// Al final se recorta a lo que QUEDA de los topes diarios, no al tope entero:
// los topes cuentan el día completo, no cada vez que se abre la app. Sin este
// descuento la cola se rellenaba a 40 después de cada tanda, el hero decía
// "40 pendientes" para siempre y "Completado ✓" no aparecía nunca — o sea que
// el freno que existía para que el día terminara hacía exactamente lo contrario.
async function loadDailyQueue(cardLoader, now) {
  const startIso = startOfDay(now).toISOString();
  const [cards, deckPriorities, retryIds, limits, hechasHoy, nuevasHoy] = await Promise.all([
    cardLoader(),
    getDeckPriorities(),
    listRetryTodayIds(startIso),
    getDailyLimits(),
    countDistinctReviewedSince(null, startIso),
    countNewIntroducedSince(startIso),
  ]);

  // Las falladas de hoy no gastan cupo: siguen pendientes, así que se descuentan
  // de lo ya hecho (misma regla que en getDailyReviewStats).
  const avanzadasHoy = Math.max(0, hechasHoy - retryIds.length);
  const restantes = limits
    ? {
        maxReviews: Math.max(0, limits.maxReviews - avanzadasHoy),
        maxNew: Math.max(0, limits.maxNew - nuevasHoy),
      }
    : null;

  return buildDailyQueue(cards, { deckPriorities, now, retryIds, limits: restantes });
}

// La pantalla de repaso necesita el texto completo para mostrar cada tarjeta.
export function getDailyQueue(now = new Date()) {
  return loadDailyQueue(listAllCards, now);
}

// Cantidad de tarjetas pendientes hoy en mazos activos (debidas + falladas).
export async function getDueCount(now = new Date()) {
  // Inicio solo cuenta: leer imágenes y texto acá castigaba cada focus.
  const queue = await loadDailyQueue(listCardsForQueue, now);
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
