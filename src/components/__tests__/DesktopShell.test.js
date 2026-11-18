import React from 'react';
import { act, create } from 'react-test-renderer';
import DesktopShell, { useDesktopNotesLayout } from '../DesktopShell';

let mockPath = '/';
const mockRouter = { navigate: jest.fn(), dismissTo: jest.fn() };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  usePathname: () => mockPath,
  useFocusEffect: (callback) => require('react').useEffect(callback, [callback]),
}));
jest.mock('react-native', () => ({
  Platform: { OS: 'web' }, StyleSheet: { create: (styles) => styles },
  Pressable: 'press', ScrollView: 'scroll', Text: 'text', View: 'view',
  useWindowDimensions: () => ({ width: 1200 }),
}));
jest.mock('@expo/vector-icons/Feather', () => () => null);
jest.mock('../ui', () => ({ Field: () => null }));
jest.mock('../CloudSyncProvider', () => ({ useCloudSync: () => null }));
jest.mock('../CreationSheet', () => () => null);
jest.mock('../../db/client', () => ({ getDb: async () => ({}) }));
jest.mock('../../db/decks', () => ({ listDecks: async () => [] }));
jest.mock('../../db/folders', () => ({ listFolders: async () => [] }));
jest.mock('../../db/notes', () => ({ listNotes: async () => [{ id: 9, title: 'Mapa general', pinned: 1 }], createNote: jest.fn(async () => 15) }));
jest.mock('../../db/transactions', () => ({ subscribeDatabaseChanges: () => () => {} }));

let screen;
beforeAll(() => {
  Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: jest.fn() });
  // El preset nativo no incluye los listeners del navegador.
  window.addEventListener = jest.fn();
  window.removeEventListener = jest.fn();
});
afterEach(async () => { await act(async () => screen?.unmount()); jest.clearAllMocks(); });

test.each(['/', '/crear', '/notas', '/progreso', '/ajustes', '/gimnasio/chat'])(
  'el botón lateral abre Biblioteca desde %s cambiando de sección', async (path) => {
    mockPath = path;
    await act(async () => { screen = create(<DesktopShell />); });
    await act(async () => screen.root.findByProps({ accessibilityLabel: 'Biblioteca' }).props.onPress());
    expect(mockRouter.navigate).toHaveBeenCalledWith('/biblioteca');
    expect(mockRouter.dismissTo).not.toHaveBeenCalled();
  }
);

test('volver a Notas desde una nota retira la pantalla del stack, muestra el índice lateral y crea nota', async () => {
  mockPath = '/notas/9';
  await act(async () => { screen = create(<DesktopShell />); });
  expect(screen.root.findByProps({ testID: 'desktop-notes-index' })).toBeTruthy();
  await act(async () => screen.root.findByProps({ accessibilityLabel: 'Crear nota' }).props.onPress());
  expect(mockRouter.navigate).toHaveBeenCalledWith('/notas/15');
  await act(async () => screen.root.findByProps({ accessibilityLabel: 'Notas' }).props.onPress());
  expect(mockRouter.dismissTo).toHaveBeenCalledWith('/notas');
});

test.each(['/carpetas/8', '/mazos/2', '/mazos/2/estudiar'])(
  'volver a Biblioteca desde %s retira las pantallas del stack', async (path) => {
    mockPath = path;
    await act(async () => { screen = create(<DesktopShell />); });
    await act(async () => screen.root.findByProps({ accessibilityLabel: 'Biblioteca' }).props.onPress());
    expect(mockRouter.dismissTo).toHaveBeenCalledWith('/biblioteca');
    expect(mockRouter.navigate).not.toHaveBeenCalled();
  }
);

test('pantalla completa en una nota oculta el riel y el índice lateral y se restaura al volver a /notas', async () => {
  let latestLayout = null;
  function Probe() {
    latestLayout = useDesktopNotesLayout();
    return null;
  }

  mockPath = '/notas/9';
  await act(async () => {
    screen = create(
      <DesktopShell>
        <Probe />
      </DesktopShell>
    );
  });
  expect(screen.root.findAllByProps({ accessibilityLabel: 'Ubicación en notas' })).toHaveLength(0);
  expect(screen.root.findAllByProps({ accessibilityLabel: 'Biblioteca' })).toHaveLength(1);
  const initialIndex = screen.root.findByProps({ testID: 'desktop-notes-index' });
  expect(initialIndex.props.pointerEvents).toBe('auto');
  expect(initialIndex.parent.props.style.width).toBe(280);
  expect(latestLayout.focused).toBe(false);

  await act(async () => latestLayout.toggleFocused());
  expect(latestLayout.focused).toBe(true);
  expect(screen.root.findAllByProps({ accessibilityLabel: 'Biblioteca' })).toHaveLength(0);
  const hiddenIndex = screen.root.findByProps({ testID: 'desktop-notes-index' });
  expect(hiddenIndex.props.pointerEvents).toBe('none');
  expect(hiddenIndex.parent.props.style.width).toBe(0);
  expect(hiddenIndex.props.style).toEqual(
    expect.arrayContaining([expect.objectContaining({ visibility: 'hidden', opacity: 0 })])
  );

  mockPath = '/notas';
  await act(async () => {
    screen.update(
      <DesktopShell>
        <Probe />
      </DesktopShell>
    );
  });
  expect(latestLayout.focused).toBe(false);
  expect(screen.root.findAllByProps({ accessibilityLabel: 'Biblioteca' })).toHaveLength(1);
  const restoredIndex = screen.root.findByProps({ testID: 'desktop-notes-index' });
  expect(restoredIndex.props.pointerEvents).toBe('auto');
  expect(restoredIndex.parent.props.style.width).toBe(280);
});
