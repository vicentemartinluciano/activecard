import React from 'react';
import { act, create } from 'react-test-renderer';

import DeckScreen from '../../app/mazos/[id]';
import { listCardsByDeck } from '../../db/cards';
import { getDeck } from '../../db/decks';

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({ id: '7' }),
  useRouter: () => ({}),
  useNavigation: () => ({ addListener: () => () => {} }),
  useFocusEffect: (callback) => require('react').useEffect(callback, [callback]),
}));
jest.mock('react-native-sortables', () => ({ default: {}, __esModule: true }));
jest.mock('../DesktopShell', () => ({ useDesktopBeforeNavigate: () => {} }));
jest.mock('../EditableCardRow', () => () => null);
jest.mock('../IconPicker', () => () => null);
jest.mock('../PercentSlider', () => () => null);
jest.mock('../ActionSheet', () => () => null);
// El contrato probado es carga/vacío/error; las animaciones y fuentes nativas
// se verifican aparte y no deben demorar la resolución de la lectura simulada.
jest.mock('@expo/vector-icons/Feather', () => () => null);
jest.mock('@expo/vector-icons/FontAwesome', () => () => null);
jest.mock('../GlowPressable', () => ({ __esModule: true, default: ({ children }) => children }));
jest.mock('../ui', () => {
  const element = (name, text, children) => require('react').createElement(name, null, text, children);
  return {
    Screen: ({ children }) => element('screen', null, children),
    Card: ({ children }) => element('card', null, children),
    EmptyState: ({ text }) => element('empty-state', text),
    Button: ({ label }) => element('button', label),
    Pill: ({ label }) => element('pill', label),
    Chip: ({ label }) => element('chip', label),
    Field: () => null,
    InlineAdd: () => null,
  };
});
jest.mock('../Stagger', () => ({ __esModule: true, default: ({ children }) => children }));
jest.mock('../Toast', () => ({ __esModule: true, default: ({ message }) =>
  require('react').createElement(require('react-native').Text, null, message) }));
jest.mock('../../db/cards', () => ({ listCardsByDeck: jest.fn() }));
jest.mock('../../db/decks', () => ({ getDeck: jest.fn(), listTags: async () => [] }));
jest.mock('../../db/folders', () => ({ listFolders: async () => [] }));
jest.mock('../../db/progress', () => ({ getDeckDailyProgress: async () => null }));
jest.mock('../../db/stats', () => ({ getDeckRecallScore: async () => null }));
jest.mock('../../db/settings', () => ({ getSetting: async (_key, fallback) => fallback }));

let screen;
const visibleText = () => JSON.stringify(screen.toJSON());

afterEach(async () => {
  await act(async () => screen?.unmount());
  jest.clearAllMocks();
});

test('no anuncia un mazo vacío mientras siguen cargando sus tarjetas', async () => {
  getDeck.mockResolvedValue({ id: 7, name: 'Mazo de prueba', tags: [], priority: 100 });
  let finishCards;
  listCardsByDeck.mockImplementation(() => new Promise((resolve) => { finishCards = resolve; }));
  await act(async () => { screen = create(<DeckScreen />); });
  expect(visibleText()).toContain('Cargando tarjetas…');
  expect(visibleText()).not.toContain('Este mazo no tiene tarjetas todavía.');

  await act(async () => finishCards([]));
  expect(visibleText()).toContain('Este mazo no tiene tarjetas todavía.');
  expect(visibleText()).not.toContain('Cargando tarjetas…');
});

test('un fallo de lectura muestra el error sin afirmar que el mazo está vacío', async () => {
  getDeck.mockResolvedValue({ id: 7, name: 'Mazo de prueba', tags: [], priority: 100 });
  listCardsByDeck.mockRejectedValue(new Error('Lectura interrumpida'));
  await act(async () => { screen = create(<DeckScreen />); });
  expect(visibleText()).toContain('No pudimos cargar este mazo.');
  expect(visibleText()).not.toContain('Este mazo no tiene tarjetas todavía.');
});

test('un mazo inexistente termina la carga con un mensaje concreto', async () => {
  getDeck.mockResolvedValue(null);
  await act(async () => { screen = create(<DeckScreen />); });
  expect(visibleText()).toContain('Este mazo ya no está disponible.');
  expect(visibleText()).not.toContain('Cargando tarjetas…');
});
