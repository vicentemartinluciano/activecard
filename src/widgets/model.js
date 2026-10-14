// La selección replica Inicio: progreso diario parcial; recientes sólo como fallback.
export const WIDGET_NAMES = { review: 'DailyReview', decks: 'StudyDecks' };

export function selectWidgetDecks(decks, progressByDeck) {
  const inProgress = decks
    .map((deck) => ({ ...deck, progress: progressByDeck[deck.id] }))
    .filter((deck) => deck.progress?.pct > 0 && deck.progress.pct < 100);
  if (inProgress.length) return { mode: 'progress', decks: inProgress.slice(0, 3) };
  const recent = [...decks].sort((a, b) =>
    String(b.last_studied_at || b.created_at).localeCompare(String(a.last_studied_at || a.created_at)) || b.id - a.id
  );
  return { mode: 'recent', decks: recent.slice(0, 3) };
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

export function widgetRowCount(height) {
  return Math.max(1, Math.min(3, Math.floor((height - 76) / 56)));
}
