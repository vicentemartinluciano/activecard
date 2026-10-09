// Los mazos en progreso tienen prioridad; los recientes completan los huecos.
// Nunca repetimos un mazo ni ocultamos uno en progreso por falta de altura.
export function homeDecks(inProgress, recent, height) {
  const progressHeight = inProgress.length ? 40 + inProgress.length * 96 + (inProgress.length - 1) * 16 + 24 : 0;
  const spare = Math.floor((height - progressHeight - 40 + 16) / 112);
  const ids = new Set(inProgress.map((deck) => deck.id));
  return recent.filter((deck) => !ids.has(deck.id)).slice(0, Math.max(0, spare));
}
