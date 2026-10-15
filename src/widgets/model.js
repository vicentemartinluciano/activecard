// Progreso parcial de hoy y recientes complementarios, sin repetir identidades.
export const WIDGET_NAMES = { review: 'DailyReview', decks: 'StudyDecks' };

export function selectWidgetDecks(decks, progressByDeck) {
  const inProgress = decks
    .map((deck) => ({ ...deck, progress: progressByDeck[deck.id] }))
    .filter((deck) => deck.progress?.pct > 0 && deck.progress.pct < 100);
  const progressIds = new Set(inProgress.map((deck) => deck.id));
  const recent = [...decks].sort((a, b) =>
    String(b.last_studied_at || b.created_at).localeCompare(String(a.last_studied_at || a.created_at)) || b.id - a.id
  );
  return { inProgress, recent: recent.filter((deck) => !progressIds.has(deck.id)) };
}

export function widgetDeckUri(deckId, mode) {
  return `activecard:///widget?target=${mode === 'progress' ? 'study' : 'deck'}&deckId=${deckId}`;
}

export function widgetDestination(target, deckId, exists) {
  if (target === 'review') return '/repaso';
  if (!['study', 'deck'].includes(target) || !/^\d+$/.test(String(deckId))) return '/biblioteca';
  const id = Number(deckId);
  if (!Number.isSafeInteger(id) || id <= 0 || !exists) return '/biblioteca';
  return `/mazos/${id}${target === 'study' ? '/estudiar' : ''}`;
}
