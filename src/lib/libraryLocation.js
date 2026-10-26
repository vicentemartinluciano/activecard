import { folderPath } from './folderTree';
import { searchLibrary } from './search';

export function locationLabel(folders, id) {
  return ['Biblioteca', ...folderPath(folders, id).map((f) => f.name)].join(' / ');
}

export function libraryContents({ folders, decks, cards = [], folderId = null, all = false, query = '', tagIds = [] }) {
  const descendants = new Set(folders.filter((f) => f.id !== folderId && folderPath(folders, f.id).some((part) => part.id === folderId)).map((f) => f.id));
  const searching = !!query.trim();
  const scopedDecks = decks.filter((d) => (folderId == null
    ? searching || all || tagIds.length || d.folder_id == null
    : d.folder_id === folderId || searching && descendants.has(d.folder_id)) &&
    (!tagIds.length || d.tags?.some((t) => tagIds.includes(t.id))));
  const scopedFolders = folders.filter((f) => folderId == null
    ? searching || !all && !tagIds.length && f.parent_id == null
    : searching ? descendants.has(f.id) : f.parent_id === folderId);
  if (!searching) return { folders: scopedFolders, decks: scopedDecks, cards: [] };
  const deckIds = new Set(scopedDecks.map((d) => d.id));
  return searchLibrary(query, { folders: scopedFolders, decks: scopedDecks, cards: cards.filter((c) => deckIds.has(c.deck_id)) });
}
