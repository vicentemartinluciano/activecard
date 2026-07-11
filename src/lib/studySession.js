// Lógica pura de una sesión de estudio (modo mazo/Quizlet): barajar y armar
// la ronda de "repasar las falladas" a partir de los ids que salieron mal.

export function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Arma la ronda extra de falladas: las tarjetas de `cards` cuyo id está en
// `failedIds`, barajadas. `cards` puede ser el pool completo de la ronda
// anterior (alcanza con buscarlas ahí, no hace falta la lista entera del mazo).
export function buildFailedRound(cards, failedIds) {
  if (!failedIds || failedIds.length === 0) return [];
  const failedSet = new Set(failedIds);
  return shuffle(cards.filter((c) => failedSet.has(c.id)));
}
