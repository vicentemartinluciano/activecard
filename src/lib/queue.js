// Cola de repaso de ActiveCard — lógica pura, sin acceso a base de datos.
// La prioridad de cada mazo es un porcentaje 0-100 elegido por el usuario:
// 0% pausa el mazo (no entra al repaso diario) y el resto pondera la
// FRECUENCIA con la que sus tarjetas aparecen intercaladas en la cola.

// Fin del día local de `date`: una tarjeta debida "hoy a cualquier hora" cuenta.
export function endOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

// Comienzo del día local de `date` (para contar lo repasado "hoy").
export function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Cola del repaso diario.
// - cards: todas las tarjetas (con deck_id y due).
// - deckPriorities: { [deckId]: 0..100 }. Sin entrada → 100 (por las dudas).
// - retryIds: tarjetas FALLADAS hoy (última nota del día = again) — FSRS ya
//   las reprogramó para mañana, pero siguen pendientes del día hasta que las
//   aciertes (fallar no es avanzar).
//
// Algoritmo: se descartan los mazos al 0%, se toman las debidas hasta el fin
// de hoy, y se intercalan por "stride scheduling" determinístico: cada mazo
// avanza con paso inversamente proporcional a su prioridad y siempre emite
// (la tarjeta más vencida de) el mazo con menor recorrido acumulado. Un mazo
// al 100% aparece el doble de seguido que uno al 50%, con ritmo parejo desde
// la primera tarjeta.
// limits: { maxReviews, maxNew } — topes diarios elegidos por el usuario. Se
// aplican AL FINAL, sobre la cola ya intercalada por stride: así lo que queda
// afuera es siempre lo de MENOR prioridad, y vuelve mañana primero. Sin
// limits, la cola sale completa (comportamiento histórico).
export function buildDailyQueue(
  cards,
  { deckPriorities = {}, now = new Date(), retryIds = [], limits = null } = {}
) {
  const limit = endOfDay(now).getTime();
  const retry = new Set(retryIds);

  const priorityOf = (deckId) => {
    const p = deckPriorities[deckId];
    return p == null ? 100 : p;
  };

  // Colas por mazo, cada una con las debidas ordenadas por más vencida primero.
  const byDeck = new Map();
  for (const card of cards) {
    if (priorityOf(card.deck_id) <= 0) continue; // mazo pausado
    if (new Date(card.due).getTime() > limit && !retry.has(card.id)) continue; // no debida aún
    if (!byDeck.has(card.deck_id)) byDeck.set(card.deck_id, []);
    byDeck.get(card.deck_id).push(card);
  }
  for (const list of byDeck.values()) {
    list.sort((a, b) => new Date(a.due) - new Date(b.due));
  }

  const STRIDE_BASE = 100000;
  const strideOf = (deckId) => STRIDE_BASE / priorityOf(deckId);

  const pass = new Map();
  const queue = [];
  while (byDeck.size > 0) {
    // Elegir el mazo con menor "pass" (empate → menor deckId, determinístico).
    let best = null;
    for (const deckId of byDeck.keys()) {
      if (!pass.has(deckId)) pass.set(deckId, strideOf(deckId));
      const p = pass.get(deckId);
      if (!best || p < best.pass || (p === best.pass && deckId < best.deckId)) {
        best = { deckId, pass: p };
      }
    }
    const list = byDeck.get(best.deckId);
    queue.push(list.shift());
    pass.set(best.deckId, best.pass + strideOf(best.deckId));
    if (list.length === 0) {
      byDeck.delete(best.deckId);
      pass.delete(best.deckId);
    }
  }

  return applyLimits(queue, limits);
}

// Recorta la cola a los topes del día. Una tarjeta es "nueva" cuando FSRS
// todavía no la vio (state 0). El tope de nuevas protege las SEMANAS que
// vienen: cada tarjeta nueva que aceptás hoy vuelve mañana, en cuatro días y
// en dos semanas — sin ese freno, un mazo generado con IA te hipoteca el mes.
function applyLimits(queue, limits) {
  if (!limits) return queue;
  // CERO SIGNIFICA AGOTADO, no "sin límite": los topes llegan acá ya
  // descontando lo que se hizo hoy (ver getDailyQueue), así que 0 quiere decir
  // "el día está completo" y la cola tiene que quedar vacía. "Sin límite" se
  // expresa con `limits` en null o con el campo ausente.
  const maxReviews = Number.isFinite(limits.maxReviews) ? limits.maxReviews : Infinity;
  const maxNew = Number.isFinite(limits.maxNew) ? limits.maxNew : Infinity;

  const out = [];
  let nuevas = 0;
  for (const card of queue) {
    if (out.length >= maxReviews) break;
    const esNueva = card.state === 0;
    if (esNueva) {
      if (nuevas >= maxNew) continue; // se saltea, pero siguen entrando repasos
      nuevas++;
    }
    out.push(card);
  }
  return out;
}
