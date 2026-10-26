import React from 'react';
import { act, create } from 'react-test-renderer';
import CreationSheet from '../CreationSheet';
import Preselection from '../../app/crear/preseleccion';
import LibraryContent from '../LibraryContent';
import DeckMoveSheet from '../DeckMoveSheet';
import { createDeck, listDecks, setDeckFolder } from '../../db/decks';
import { createCard } from '../../db/cards';
import { listFolders } from '../../db/folders';
import { persistDraft } from '../../lib/draftStore';

let mockDraft;
const mockRouter = { push: jest.fn(), replace: jest.fn(), dismissTo: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, Stack: { Screen: () => null } }));
jest.mock('react-native', () => ({
  Platform: { OS: 'android', select: (v) => v.android ?? v.default },
  StyleSheet: { create: (s) => s },
  Text: 'text', View: 'view', ScrollView: 'scroll', Pressable: 'press', ActivityIndicator: 'busy',
  FlatList: ({ data, renderItem, ListHeaderComponent, ListFooterComponent }) => require('react').createElement('list', null, ListHeaderComponent, data.map((item) => require('react').createElement('row', { key: item.key }, renderItem({ item }))), ListFooterComponent),
}));
jest.mock('../ui', () => Object.fromEntries(['Button', 'Field', 'Chip', 'Card', 'Screen'].map((name) => [name, (props) => require('react').createElement(name, props, props.children)])));
jest.mock('../ActionSheet', () => ({ visible, children }) => visible ? require('react').createElement('sheet', null, children) : null);
jest.mock('../FolderPicker', () => (props) => require('react').createElement('folder-picker', props));
jest.mock('../NotionField', () => () => null);
jest.mock('@expo/vector-icons/Feather', () => () => null);
jest.mock('../DeckListItem', () => (props) => require('react').createElement('deck-item', props));
jest.mock('../LibraryBreadcrumbs', () => () => null);
jest.mock('../Toast', () => (props) => require('react').createElement('toast', props));
jest.mock('../../db/decks', () => ({ createDeck: jest.fn(), listDecks: jest.fn(), setDeckFolder: jest.fn() }));
jest.mock('../../db/cards', () => ({ createCard: jest.fn() }));
jest.mock('../../db/folders', () => ({ createFolder: jest.fn(), listFolders: jest.fn() }));
jest.mock('../../lib/draftStore', () => ({ DRAFT_KEY: 'generationDraft', getDraft: () => mockDraft, loadDraft: jest.fn(async () => mockDraft), persistDraft: jest.fn(async (value) => { mockDraft = value; }), clearDraft: jest.fn() }));
let screen;
const button = (label) => screen.root.findAllByType('Button').find((b) => b.props.label === label);
beforeAll(() => {
  Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: jest.fn(() => { throw new Error('Esta prueba usa datos locales.'); }) });
});
beforeEach(() => {
  listFolders.mockResolvedValue([{ id: 8, name: 'Operaciones' }]);
  listDecks.mockResolvedValue([]);
  createDeck.mockResolvedValue(20);
  createCard.mockResolvedValue(30);
  mockDraft = { sourceLabel: 'Texto', folderId: 8, createNewDeck: true, newDeckName: 'Unidad', cards: [{ key: 'a', front: 'Pregunta', back: 'Respuesta', kept: true }] };
});
afterEach(async () => { await act(async () => screen?.unmount()); jest.clearAllMocks(); });

test('creación manual hereda carpeta, bloquea doble toque y abre el mazo correcto', async () => {
  let finish;
  createDeck.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  const close = jest.fn();
  await act(async () => { screen = create(<CreationSheet kind="mazo" folderId={8} onClose={close} />); });
  expect(screen.root.findByType('folder-picker').props.value).toBe(8);
  await act(async () => screen.root.findByType('Field').props.onChangeText('Nuevo'));
  const submit = button('Crear y abrir').props.onPress;
  await act(async () => { submit(); submit(); });
  expect(createDeck).toHaveBeenCalledTimes(1);
  expect(createDeck).toHaveBeenCalledWith('Nuevo', 8);
  await act(async () => finish(20));
  expect(mockRouter.push).toHaveBeenCalledWith('/mazos/20');
  expect(close).toHaveBeenCalledTimes(1);
});
test('cancelar no escribe y reabrir desde Crear empieza en raíz', async () => {
  const close = jest.fn();
  await act(async () => { screen = create(<CreationSheet kind="mazo" folderId={8} onClose={close} />); });
  await act(async () => button('Cancelar').props.onPress());
  expect(createDeck).not.toHaveBeenCalled(); expect(persistDraft).not.toHaveBeenCalled();
  await act(async () => screen.update(<CreationSheet kind={null} onClose={close} />));
  await act(async () => screen.update(<CreationSheet kind="mazo" onClose={close} />));
  expect(screen.root.findByType('folder-picker').props.value).toBeNull();
});
test('un destino eliminado conserva el nombre y permite corregir la ubicación', async () => {
  await act(async () => { screen = create(<CreationSheet kind="mazo" folderId={8} onClose={() => {}} />); });
  await act(async () => screen.root.findByType('Field').props.onChangeText('Nuevo'));
  listFolders.mockResolvedValue([]);
  await act(async () => button('Crear y abrir').props.onPress());
  expect(createDeck).not.toHaveBeenCalled();
  expect(screen.root.findByType('Field').props.value).toBe('Nuevo');
  await act(async () => screen.root.findByType('folder-picker').props.onChange(null));
  await act(async () => button('Crear y abrir').props.onPress());
  expect(createDeck).toHaveBeenCalledWith('Nuevo', null);
});
test('preselección no crea un mazo hasta guardar y reintenta en el mismo mazo después de un fallo', async () => {
  createCard.mockRejectedValueOnce(new Error('Interrumpido'));
  await act(async () => { screen = create(<Preselection />); });
  expect(createDeck).not.toHaveBeenCalled();
  await act(async () => button('Guardar 1 tarjeta').props.onPress());
  expect(createDeck).toHaveBeenCalledWith('Unidad', 8, expect.objectContaining({ draftKey: 'generationDraft' }));
  await act(async () => button('Guardar 1 tarjeta').props.onPress());
  expect(createDeck).toHaveBeenCalledTimes(1);
  expect(createCard).toHaveBeenLastCalledWith(expect.objectContaining({ deckId: 20 }));
  expect(mockRouter.dismissTo).toHaveBeenCalledWith('/carpetas/8');
  expect(mockRouter.push).toHaveBeenCalledWith('/mazos/20');
});
test('preselección permite corregir una carpeta eliminada y conserva la nueva elección al guardar', async () => {
  listFolders.mockResolvedValue([]);
  await act(async () => { screen = create(<Preselection />); });
  expect(button('Guardar 1 tarjeta').props.disabled).toBe(true);
  await act(async () => screen.root.findByType('folder-picker').props.onChange(null));
  expect(button('Guardar 1 tarjeta').props.disabled).toBe(false);
  await act(async () => button('Guardar 1 tarjeta').props.onPress());
  expect(createDeck).toHaveBeenCalledWith('Unidad', null, expect.anything());
});

test('Biblioteca alterna raíz y todos los mazos y busca contenido anidado', async () => {
  const folders = [{ id: 8, name: 'Operaciones' }];
  const decks = [{ id: 1, name: 'Suelto', folder_id: null }, { id: 2, name: 'Unidad 1', folder_id: 8 }];
  await act(async () => { screen = create(<LibraryContent folders={folders} decks={decks} />); });
  expect(screen.root.findAllByType('deck-item').map((r) => r.props.deck.id)).toEqual([1]);
  await act(async () => screen.root.findAllByType('Chip').find((c) => c.props.label === 'Todos los mazos').props.onPress());
  expect(screen.root.findAllByType('deck-item').map((r) => r.props.deck.id)).toEqual([1, 2]);
  await act(async () => screen.root.findByType('Field').props.onChangeText('unidad'));
  expect(screen.root.findAllByType('deck-item').map((r) => r.props.deck.id)).toEqual([2]);
  await act(async () => button('Nuevo mazo').props.onPress());
  expect(button('Manual')).toBeDefined();
});

test('mover desde otra carpeta muestra origen/destino y bloquea un doble envío', async () => {
  listDecks.mockResolvedValue([{ id: 2, name: 'Unidad', folder_id: 9 }]);
  listFolders.mockResolvedValue([{ id: 8, name: 'Operaciones' }, { id: 9, name: 'Otra materia' }]);
  let finish;
  setDeckFolder.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  const moved = jest.fn(), close = jest.fn();
  await act(async () => { screen = create(<DeckMoveSheet visible targetFolderId={8} onMoved={moved} onClose={close} />); });
  await act(async () => screen.root.findByType('Card').props.onPress());
  expect(JSON.stringify(screen.toJSON())).toContain('Otra materia');
  expect(screen.root.findByType('folder-picker').props.value).toBe(8);
  const submit = button('Confirmar movimiento').props.onPress;
  await act(async () => { submit(); submit(); });
  expect(setDeckFolder).toHaveBeenCalledTimes(1);
  expect(setDeckFolder).toHaveBeenCalledWith(2, 8);
  await act(async () => finish());
  expect(moved).toHaveBeenCalledTimes(1); expect(close).toHaveBeenCalledTimes(1);
});
