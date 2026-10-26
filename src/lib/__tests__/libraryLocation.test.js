import { libraryContents, locationLabel } from '../libraryLocation';

const folders = [{ id: 1, name: 'Facultad' }, { id: 2, name: 'Operaciones', parent_id: 1 }, { id: 3, name: 'Otra materia', parent_id: 1 }];
const decks = [{ id: 1, name: 'Suelto', folder_id: null, tags: [] }, { id: 2, name: 'Unidad', folder_id: 2, tags: [{ id: 9, name: 'Parcial' }] }, { id: 3, name: 'Unidad', folder_id: 3, tags: [] }];
const cards = [{ id: 10, deck_id: 2, front: 'Programación lineal', back: 'Restricciones' }, { id: 11, deck_id: 3, front: 'Programación', back: 'Otro tema' }];
const content = (options = {}) => libraryContents({ folders, decks, cards, ...options });

test('raíz muestra sólo carpetas raíz y mazos sueltos; Todos conserva el catálogo completo', () => {
  expect(content().folders.map((f) => f.id)).toEqual([1]);
  expect(content().decks.map((d) => d.id)).toEqual([1]);
  expect(content({ all: true }).decks).toEqual(decks);
  expect(content({ all: true }).folders).toEqual([]);
});
test('carpeta muestra hijos directos y busca tarjetas en descendientes sin incluir otras materias', () => {
  expect(content({ folderId: 1 }).folders.map((f) => f.id)).toEqual([2, 3]);
  expect(content({ folderId: 1 }).decks).toEqual([]);
  expect(content({ folderId: 2, query: 'programacion' }).cards.map((c) => c.id)).toEqual([10]);
  expect(content({ folderId: 1, query: 'programación' }).cards.map((c) => c.id)).toEqual([10, 11]);
});
test('buscar en raíz y filtrar etiquetas incluye mazos anidados y sus tarjetas', () => {
  expect(content({ query: 'unidad' }).decks.map((d) => d.id)).toEqual([2, 3]);
  expect(content({ tagIds: [9] }).decks.map((d) => d.id)).toEqual([2]);
  expect(content({ query: 'programacion', tagIds: [9] }).cards.map((c) => c.id)).toEqual([10]);
});
test('rutas completas distinguen mazos con el mismo nombre', () => {
  expect(locationLabel(folders, 2)).toBe('Biblioteca / Facultad / Operaciones');
  expect(locationLabel(folders, null)).toBe('Biblioteca');
});
