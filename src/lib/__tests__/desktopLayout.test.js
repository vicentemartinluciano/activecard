import { desktopSection, hasLibraryIndex, libraryTree } from '../desktopLayout';

describe('Navegación de escritorio', () => {
  test('conserva la biblioteca en el editor y retira el índice durante el estudio', () => {
    expect(hasLibraryIndex('/mazos/12/tarjeta')).toBe(true);
    expect(hasLibraryIndex('/mazos/12/estudiar')).toBe(false);
    expect(hasLibraryIndex('/mazos/debiles/estudiar')).toBe(false);
    expect(desktopSection('/gimnasio/historial')).toBe('gimnasio');
  });
  test('buscar un mazo muestra su carpeta aunque esté plegada', () => {
    const folders = [{ id: 1, name: 'Administración' }, { id: 2, name: 'Lecturas' }];
    const decks = [{ id: 10, name: 'Dirección', folder_id: 1 }, { id: 11, name: 'Suelto', folder_id: null }];
    expect(libraryTree(folders, decks, 'direccion')).toEqual({ folders: [{ ...folders[0], children: [decks[0]] }], loose: [] });
    expect(libraryTree(folders, decks, 'administracion').folders[0].children).toEqual([decks[0]]);
  });
  test('un mazo con una carpeta ausente sigue accesible en la raíz', () => {
    const orphan = { id: 12, name: 'Mazo', folder_id: 99 };
    expect(libraryTree([], [orphan]).loose).toEqual([orphan]);
  });
});
