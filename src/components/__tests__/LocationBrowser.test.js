import React from 'react';
import { act, create } from 'react-test-renderer';
import FolderPicker from '../FolderPicker';
import LocationBrowser from '../LocationBrowser';
import { canMoveFolder } from '../../lib/folderTree';

jest.mock('react-native', () => ({ Platform: { OS: 'android', select: (v) => v.default }, StyleSheet: { create: (s) => s }, Text: 'text', View: 'view', ScrollView: 'scroll', Pressable: 'press' }));
jest.mock('@expo/vector-icons/Feather', () => () => null);
jest.mock('../ui', () => Object.fromEntries(['Field', 'Button', 'EmptyState'].map((name) => [name, (props) => require('react').createElement(name, props, props.children)])));
const folders = [{ id: 1, name: 'Facultad' }, { id: 2, name: 'Unidad', parent_id: 1 }, { id: 3, name: 'Unidad' }, { id: 4, name: 'Apuntes', parent_id: 2 }];
let screen;
const press = (label) => screen.root.findByProps({ accessibilityLabel: label }).props.onPress();
const button = (label) => screen.root.findAllByType('Button').find((node) => node.props.label === label);
afterEach(async () => { await act(async () => screen?.unmount()); });

test('cambiar la carpeta y cancelar conserva la selección y el nombre del formulario padre', async () => {
  const changed = jest.fn();
  await act(async () => { screen = create(<FolderPicker folders={folders} value={2} onChange={changed} />); });
  await act(async () => button('Cambiar').props.onPress());
  await act(async () => press('Elegir ubicación Biblioteca'));
  await act(async () => press('Abrir destino Biblioteca / Unidad'));
  expect(changed).not.toHaveBeenCalled();
  await act(async () => button('Cancelar cambio').props.onPress());
  expect(changed).not.toHaveBeenCalled();
  await act(async () => button('Cambiar').props.onPress());
  await act(async () => button('Usar esta carpeta').props.onPress());
  expect(changed).toHaveBeenCalledWith(2);
});

test('la raíz sigue accesible durante búsqueda y las carpetas repetidas muestran su ruta', async () => {
  const changed = jest.fn();
  await act(async () => { screen = create(<LocationBrowser folders={folders} value={2} onChange={changed} />); });
  await act(async () => screen.root.findByType('Field').props.onChangeText('unidad'));
  expect(screen.root.findByProps({ accessibilityLabel: 'Abrir destino Biblioteca / Facultad / Unidad' })).toBeDefined();
  expect(screen.root.findByProps({ accessibilityLabel: 'Abrir destino Biblioteca / Unidad' })).toBeDefined();
  await act(async () => press('Elegir ubicación Biblioteca'));
  expect(changed).toHaveBeenCalledWith(null);
  expect(screen.root.findByType('Field').props.value).toBe('');
});

test('mover una carpeta excluye ella misma y sus descendientes, incluso buscando', async () => {
  await act(async () => { screen = create(<LocationBrowser folders={folders} value={null} onChange={() => {}} allowed={(id) => canMoveFolder(folders, 1, id)} />); });
  await act(async () => screen.root.findByType('Field').props.onChangeText('unidad'));
  const destinations = screen.root.findAllByType('press').map((node) => node.props.accessibilityLabel);
  expect(destinations).toContain('Abrir destino Biblioteca / Unidad');
  expect(destinations).not.toContain('Abrir destino Biblioteca / Facultad / Unidad');
});
