import { selectWidgetDecks, widgetDeckUri, widgetDestination, widgetRowCount } from '../model';

const decks = [
  { id: 1, name: 'A', created_at: '2026-10-01T12:00:00Z', last_studied_at: '2026-10-11T12:00:00Z' },
  { id: 2, name: 'B', created_at: '2026-10-12T12:00:00Z', last_studied_at: null },
  { id: 3, name: 'C', created_at: '2026-10-01T12:00:00Z', last_studied_at: '2026-10-13T12:00:00Z' },
  { id: 4, name: 'D', created_at: '2026-10-01T12:00:00Z', last_studied_at: null },
];
test('prioriza únicamente progreso parcial del día y conserva el orden de Inicio', () => {
  const result = selectWidgetDecks(decks, { 1: { pct: 30 }, 2: { pct: 0 }, 3: { pct: 100 }, 4: { pct: 70 } });
  expect(result.mode).toBe('progress');
  expect(result.decks.map((deck) => deck.id)).toEqual([1, 4]);
});
test('al cambiar el día o completar todos, cae a recientes sin mutar la biblioteca', () => {
  const result = selectWidgetDecks(decks, {});
  expect(result.mode).toBe('recent');
  expect(result.decks.map((deck) => deck.id)).toEqual([3, 2, 1]);
  expect(decks.map((deck) => deck.id)).toEqual([1, 2, 3, 4]);
  expect(selectWidgetDecks(decks, { 1: { pct: 100 } })).toEqual(result);
});
test('biblioteca vacía y límite de tres mazos', () => {
  expect(selectWidgetDecks([], {})).toEqual({ mode: 'recent', decks: [] });
  expect(selectWidgetDecks(decks, Object.fromEntries(decks.map((d) => [d.id, { pct: 50 }]))).decks).toHaveLength(3);
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
test('el tamaño compacto limita filas sin perder el acceso a Biblioteca', () => {
  expect(widgetRowCount(154)).toBe(1);
  expect(widgetRowCount(200)).toBe(2);
  expect(widgetRowCount(260)).toBe(3);
  expect(widgetRowCount(500)).toBe(3);
});
