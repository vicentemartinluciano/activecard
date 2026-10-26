import React from 'react';
import { act, create } from 'react-test-renderer';

import DeckScreen from '../../app/mazos/[id]';
import { createCard, getCard, listCardsByDeck, updateCardText } from '../../db/cards';
import { getDeck } from '../../db/decks';
const mockRouter = { dismissTo: jest.fn() };

// Esta prueba observa las transiciones de carga de la pantalla real. Los
// componentes host evitan iniciar ScrollView y vistas Expo nativas al resolver
// la primera lectura: ese arranque diferido agotaba los 5 s en Windows.
jest.mock('react-native', () => ({
  Platform: { OS: 'android', select: values => values.android ?? values.default },
  StyleSheet: { create: styles => styles },
  View: 'View', Text: 'Text', ScrollView: 'ScrollView', Pressable: 'Pressable',
  Animated: {
    View: 'AnimatedView',
    Value: class { setValue() {} interpolate() { return 0; } },
    timing: jest.fn(() => ({ start: jest.fn(), stop: jest.fn() })),
  },
}));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }));

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({ id: '7' }),
  useRouter: () => mockRouter,
  useNavigation: () => ({ addListener: () => () => {} }),
  useFocusEffect: (callback) => require('react').useEffect(callback, [callback]),
}));
jest.mock('react-native-sortables', () => ({ default: {}, __esModule: true }));
jest.mock('../DesktopShell', () => ({ useDesktopBeforeNavigate: () => {} }));
jest.mock('../EditableCardRow', () => (props) => require('react').createElement('editable-row', props));
jest.mock('../Collapsible', () => () => null);
jest.mock('../ConfirmDeleteSheet', () => () => null);
jest.mock('../../lib/backupIO', () => ({ exportDeck: jest.fn() }));
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
    Button: ({ label, onPress }) => require('react').createElement('button', { onPress }, label),
    Pill: ({ label }) => element('pill', label),
    Chip: ({ label }) => element('chip', label),
    Field: () => null,
    InlineAdd: () => null,
  };
});
jest.mock('../Toast', () => ({ __esModule: true, default: ({ message }) =>
  require('react').createElement(require('react-native').Text, null, message) }));
jest.mock('../../db/cards', () => ({ listCardsByDeck: jest.fn(), createCard: jest.fn(), getCard: jest.fn(), updateCardText: jest.fn() }));
jest.mock('../../db/decks', () => ({ getDeck: jest.fn(), listTags: async () => [] }));
jest.mock('../../db/folders', () => ({ listFolders: async () => [] }));
jest.mock('../../db/progress', () => ({ getDeckDailyProgress: async () => null }));
jest.mock('../../db/stats', () => ({ getDeckRecallScore: async () => null }));
jest.mock('../../db/settings', () => ({ getSetting: async (_key, fallback) => fallback, listCardDrafts: jest.fn().mockResolvedValue([]), setSetting: jest.fn().mockResolvedValue() }));

let screen;
const visibleText = () => JSON.stringify(screen.toJSON());

beforeAll(() => {
  // El fetch lazy del preset Expo no debe iniciar módulos nativos al limpiar
  // este fixture local. Cualquier solicitud de red sería un error de la prueba.
  Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true,
    value: jest.fn(() => { throw new Error('La prueba de carga local no usa red.'); }) });
});

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

test('abre el mazo editable y guarda el borrador antes de activar otra tarjeta', async () => {
  getDeck.mockResolvedValue({ id: 7, name: 'Mazo', tags: [], priority: 100 });
  listCardsByDeck.mockResolvedValue([{ id: 1, front: 'Uno', back: 'Dorso' }, { id: 2, front: 'Dos', back: 'Otro' }]);
  updateCardText.mockResolvedValue();
  await act(async () => { screen = create(<DeckScreen />); });
  expect(screen.root.findAllByType('editable-row')).toHaveLength(2);
  await act(async () => screen.root.findAllByType('editable-row')[0].props.onActivate(1));
  await act(async () => screen.root.findAllByType('editable-row')[0].props.onChangeDraft({ front: 'Uno editado', back: 'Dorso' }));
  await act(async () => screen.root.findAllByType('editable-row')[1].props.onActivate(2));
  expect(updateCardText).toHaveBeenCalledWith(1, 'Uno editado', 'Dorso', expect.objectContaining({ expected: { front: 'Uno', back: 'Dorso' } }));
  expect(screen.root.findAllByType('editable-row')[1].props.active).toBe(true);
});

test('la tarjeta nueva se guarda sola una vez y conserva el editor activo', async () => {
  jest.useFakeTimers();
  getDeck.mockResolvedValue({ id: 7, name: 'Mazo', tags: [], priority: 100 });
  listCardsByDeck.mockResolvedValue([]);
  let finishCreate;
  createCard.mockImplementation(() => new Promise((resolve) => { finishCreate = resolve; }));
  getCard.mockResolvedValue({ id: 3, front: 'Pregunta', back: 'Respuesta' });
  await act(async () => { screen = create(<DeckScreen />); });
  await act(async () => screen.root.findByProps({ accessibilityLabel: 'Nueva tarjeta' }).props.onPress());
  expect(createCard).not.toHaveBeenCalled();
  await act(async () => screen.root.findByType('editable-row').props.onChangeDraft({ front: 'Pregunta', back: 'Respuesta' }));
  expect(visibleText()).not.toContain('Guardar tarjeta');
  expect(visibleText()).not.toContain('Reordenar tarjetas');
  await act(async () => jest.advanceTimersByTime(350));
  expect(createCard).toHaveBeenCalledTimes(1);
  await act(async () => { finishCreate(3); });
  expect(screen.root.findByType('editable-row').props.card.id).toBe(3);
  expect(screen.root.findByType('editable-row').props.active).toBe(true);
  jest.useRealTimers();
});

test('escribir y autoguardar no repiten la entrada ni remontan el editor', async () => {
  jest.useFakeTimers();
  const { Animated } = require('react-native');
  getDeck.mockResolvedValue({ id: 7, name: 'Mazo', tags: [], priority: 100 });
  listCardsByDeck.mockResolvedValue([{ id: 1, front: 'Pregunta', back: 'Respuesta' }]);
  let finishSave;
  updateCardText.mockImplementation(() => new Promise((resolve) => { finishSave = resolve; }));
  await act(async () => { screen = create(<DeckScreen />); });
  await act(async () => screen.root.findByType('editable-row').props.onActivate(1));
  const editor = screen.root.findByType('editable-row');
  const entries = Animated.timing.mock.calls.length;
  for (const front of ['P', 'Pr', 'Pregunta editada']) {
    await act(async () => editor.props.onChangeDraft({ front, back: 'Respuesta' }));
    expect(screen.root.findByType('editable-row')).toBe(editor);
    expect(Animated.timing).toHaveBeenCalledTimes(entries);
    expect(visibleText()).not.toMatch(/Guardando|Borrador guardado/);
  }
  await act(async () => jest.advanceTimersByTime(350));
  expect(updateCardText).toHaveBeenCalledTimes(1);
  expect(visibleText()).not.toMatch(/Guardando|Borrador guardado/);
  expect(Animated.timing).toHaveBeenCalledTimes(entries);
  await act(async () => finishSave());
  expect(screen.root.findByType('editable-row')).toBe(editor);
  expect(Animated.timing).toHaveBeenCalledTimes(entries);
  jest.useRealTimers();
});

test('ir a un ancestro guarda primero el texto y conserva el borrador si falla', async () => {
  getDeck.mockResolvedValue({ id: 7, name: 'Mazo', tags: [], priority: 100 });
  listCardsByDeck.mockResolvedValue([{ id: 1, front: 'Pregunta', back: 'Respuesta' }]);
  updateCardText.mockRejectedValueOnce(new Error('No se pudo guardar'));
  await act(async () => { screen = create(<DeckScreen />); });
  await act(async () => screen.root.findByType('editable-row').props.onActivate(1));
  await act(async () => screen.root.findByType('editable-row').props.onChangeDraft({ front: 'Texto pendiente', back: 'Respuesta' }));
  await act(async () => screen.root.findByProps({ accessibilityLabel: 'Ir a Biblioteca' }).props.onPress());
  expect(mockRouter.dismissTo).not.toHaveBeenCalled();
  expect(screen.root.findByType('editable-row').props.draft.front).toBe('Texto pendiente');
  updateCardText.mockResolvedValueOnce();
  await act(async () => screen.root.findByProps({ accessibilityLabel: 'Ir a Biblioteca' }).props.onPress());
  expect(updateCardText).toHaveBeenLastCalledWith(1, 'Texto pendiente', 'Respuesta', expect.anything());
  expect(mockRouter.dismissTo).toHaveBeenCalledWith('/biblioteca');
});
