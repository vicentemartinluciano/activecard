// Funciones puras compartidas por navegación, importación y validación.
export function folderPath(folders, id) {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const path = [];
  const seen = new Set();
  while (id != null && byId.has(id) && !seen.has(id)) {
    seen.add(id);
    const folder = byId.get(id);
    path.unshift(folder);
    id = folder.parent_id;
  }
  return path;
}

export function canMoveFolder(folders, id, parentId) {
  if (parentId == null) return true;
  return folders.some((folder) => folder.id === parentId) && !folderPath(folders, parentId).some((folder) => folder.id === id);
}

export function validateFolderTree(folders) {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  for (const folder of folders) {
    const seen = new Set([folder.id]);
    let parent = folder.parent_id;
    while (parent != null) {
      if (seen.has(parent) || !byId.has(parent)) throw new Error("La jerarquía de carpetas no es válida.");
      seen.add(parent);
      parent = byId.get(parent).parent_id;
    }
  }
}

export function flattenFolders(folders, parentId = null, depth = 0) {
  return folders.filter((folder) => (folder.parent_id ?? null) === parentId)
    .flatMap((folder) => [{ ...folder, depth }, ...flattenFolders(folders, folder.id, depth + 1)]);
}
