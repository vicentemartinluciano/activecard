import { homeDecks } from '../homeDecks';

const decks = [1, 2, 3, 4].map((id) => ({ id }));

test('sin mazos en progreso llena el espacio con recientes', () => {
  expect(homeDecks([], decks, 396)).toEqual(decks.slice(0, 3));
});

test('los recientes no duplican los mazos en progreso', () => {
  expect(homeDecks([decks[0]], decks, 396)).toEqual([decks[1]]);
});

test('cuando progreso ocupa el panel no agrega recientes', () => {
  expect(homeDecks(decks.slice(0, 3), decks, 396)).toEqual([]);
});

test('una ventana más alta permite completar con más recientes', () => {
  expect(homeDecks([decks[0]], decks, 776)).toEqual(decks.slice(1));
});
