// Cola de repaso de ActiveCard — lógica pura, sin acceso a base de datos.
// Recibe tarjetas y prioridades ya cargadas y decide QUÉ se repasa y en QUÉ orden.

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

export function monthKey(date = new Date()) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Peso efectivo de una tarjeta según las prioridades del mes:
// el MÁXIMO entre el peso de su mazo y el de cualquier etiqueta del mazo.
// Sin prioridad configurada → 1 (normal).
// - priorities: [{target_type: 'deck'|'tag', target_id, weight, month}]
// - deckTags: { [deckId]: [tagId, ...] }
export function cardWeight(card, priorities, deckTags, month) {
  let weight = 1;
  for (const p of priorities) {
    if (p.month !== month) continue;
    const matchesDeck = p.target_type === "deck" && p.target_id === card.deck_id;
    const matchesTag =
      p.target_type === "tag" &&
      (deckTags[card.deck_id] || []).includes(p.target_id);
    if ((matchesDeck || matchesTag) && p.weight > weight) weight = p.weight;
  }
  return weight;
}

// Cola del repaso diario: tarjetas debidas hasta el fin de hoy,
// ordenadas por peso mensual (desc) y luego la más vencida primero.
// Con focusDeckIds (Modo Enfoque): se limita a esos mazos y, si hay menos de
// minFocus debidas, se completa con las próximas a vencer de esos mismos mazos.
export function buildDailyQueue(
  cards,
  { priorities = [], deckTags = {}, now = new Date(), focusDeckIds = null, minFocus = 10 } = {}
) {
  const limit = endOfDay(now).getTime();
  const month = monthKey(now);

  let pool = cards;
  if (focusDeckIds && focusDeckIds.length > 0) {
    pool = cards.filter((c) => focusDeckIds.includes(c.deck_id));
  }

  const due = pool.filter((c) => new Date(c.due).getTime() <= limit);
  const sortByPriority = (list) =>
    list
      .map((c) => ({ card: c, weight: cardWeight(c, priorities, deckTags, month) }))
      .sort((a, b) => {
        if (b.weight !== a.weight) return b.weight - a.weight;
        return new Date(a.card.due) - new Date(b.card.due);
      })
      .map((e) => e.card);

  let queue = sortByPriority(due);

  // Modo Enfoque con pocas debidas: adelantar las próximas a vencer del tema.
  if (focusDeckIds && focusDeckIds.length > 0 && queue.length < minFocus) {
    const upcoming = pool
      .filter((c) => new Date(c.due).getTime() > limit)
      .sort((a, b) => new Date(a.due) - new Date(b.due))
      .slice(0, minFocus - queue.length);
    queue = [...queue, ...upcoming];
  }

  return queue;
}
