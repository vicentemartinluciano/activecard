import React from 'react';
import { act, create } from 'react-test-renderer';
import DesktopShell from '../DesktopShell';

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
jest.mock('../../db/transactions', () => ({ subscribeDatabaseChanges: () => () => {} }));

let screen;
beforeAll(() => {
  Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: jest.fn() });
  // El preset nativo no incluye los listeners del navegador.
  window.addEventListener = jest.fn();
  window.removeEventListener = jest.fn();
});
afterEach(async () => { await act(async () => screen?.unmount()); jest.clearAllMocks(); });

test.each(['/', '/crear', '/progreso', '/ajustes', '/gimnasio/chat'])(
  'el botón lateral abre Biblioteca desde %s cambiando de sección', async (path) => {
    mockPath = path;
    await act(async () => { screen = create(<DesktopShell />); });
    await act(async () => screen.root.findByProps({ accessibilityLabel: 'Biblioteca' }).props.onPress());
    expect(mockRouter.navigate).toHaveBeenCalledWith('/biblioteca');
    expect(mockRouter.dismissTo).not.toHaveBeenCalled();
  }
);

test.each(['/carpetas/8', '/mazos/2', '/mazos/2/estudiar'])(
  'volver a Biblioteca desde %s retira las pantallas del stack', async (path) => {
    mockPath = path;
    await act(async () => { screen = create(<DesktopShell />); });
    await act(async () => screen.root.findByProps({ accessibilityLabel: 'Biblioteca' }).props.onPress());
    expect(mockRouter.dismissTo).toHaveBeenCalledWith('/biblioteca');
    expect(mockRouter.navigate).not.toHaveBeenCalled();
  }
);
