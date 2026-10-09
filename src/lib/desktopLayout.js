export const DESKTOP_RAIL_WIDTH = 60;
export const DESKTOP_INDEX_WIDTH = 280;

export function desktopSection(path) {
  if (path.startsWith('/gimnasio')) return 'gimnasio';
  if (path.startsWith('/mazos') || path.startsWith('/carpetas') || path === '/biblioteca') return 'biblioteca';
  if (path.startsWith('/crear')) return 'crear';
  if (path.startsWith('/progreso')) return 'progreso';
  if (path.startsWith('/ajustes')) return 'ajustes';
  return 'inicio';
}

export function hasLibraryIndex(path) {
  return desktopSection(path) === 'biblioteca' && !path.endsWith('/estudiar');
}

export function libraryTree(folders, decks, query = '') {
  const normalize = (text) => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const needle = normalize(query.trim());
  const matches = (item) => normalize(item.name).includes(needle);
  const roots = folders.map((folder) => ({
    ...folder,
    children: decks.filter((deck) => deck.folder_id === folder.id && (!needle || matches(folder) || matches(deck))),
  })).filter((folder) => !needle || matches(folder) || folder.children.length);
  const folderIds = new Set(folders.map((folder) => folder.id));
  return { folders: roots, loose: decks.filter((deck) => !folderIds.has(deck.folder_id) && (!needle || matches(deck))) };
}
