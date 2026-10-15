import { selectWidgetDecks, widgetDeckUri, widgetDestination } from '../model';

const decks = [
  { id: 1, name: 'A', created_at: '2026-10-01T12:00:00Z', last_studied_at: '2026-10-11T12:00:00Z' },
  { id: 2, name: 'B', created_at: '2026-10-12T12:00:00Z', last_studied_at: null },
  { id: 3, name: 'C', created_at: '2026-10-01T12:00:00Z', last_studied_at: '2026-10-13T12:00:00Z' },
  { id: 4, name: 'D', created_at: '2026-10-01T12:00:00Z', last_studied_at: null },
];
test('conserva progreso parcial de hoy y agrega recientes ordenados sin duplicados', () => {
  const result = selectWidgetDecks(decks, { 1: { pct: 30 }, 2: { pct: 0 }, 3: { pct: 100 }, 4: { pct: 70 } });
  expect(result.inProgress.map((deck) => deck.id)).toEqual([1, 4]);
  expect(result.recent.map((deck) => deck.id)).toEqual([3, 2]);
});
test('al cambiar el día o completar todos, ofrece recientes sin mutar la biblioteca', () => {
  const result = selectWidgetDecks(decks, {});
  expect(result.inProgress).toEqual([]);
  expect(result.recent.map((deck) => deck.id)).toEqual([3, 2, 1, 4]);
  expect(decks.map((deck) => deck.id)).toEqual([1, 2, 3, 4]);
  expect(selectWidgetDecks(decks, { 1: { pct: 100 } })).toEqual(result);
});
test('no limita datos a tres: el espacio disponible decide cuántos mostrar', () => {
  expect(selectWidgetDecks([], {})).toEqual({ inProgress: [], recent: [] });
  expect(selectWidgetDecks(decks, Object.fromEntries(decks.map((d) => [d.id, { pct: 50 }]))).inProgress).toHaveLength(4);
});
test('enlaces a estudio o detalle y fallback para mazo eliminado o ID inválido', () => {
  expect(widgetDeckUri(3, 'progress')).toBe('activecard:///widget?target=study&deckId=3');
  expect(widgetDeckUri(3, 'recent')).toBe('activecard:///widget?target=deck&deckId=3');
  expect(widgetDestination('study', '3', true)).toBe('/mazos/3/estudiar');
  expect(widgetDestination('deck', '3', true)).toBe('/mazos/3');
  expect(widgetDestination('study', '3', false)).toBe('/biblioteca');
  for (const invalid of ['-1', 'NaN', '3/editar', ['1', '2'], '0', '1e4', '9007199254740992']) {
    expect(widgetDestination('study', invalid, true)).toBe('/biblioteca');
  }
});
