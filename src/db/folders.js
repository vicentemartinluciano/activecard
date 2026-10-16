import { withDbTransaction } from "./transactions";
// Repositorio de carpetas (API asíncrona). Una carpeta agrupa mazos:
// cada mazo pertenece a 0 o 1 carpeta (decks.folder_id).

import { getDb } from "./client";
import { canMoveFolder } from "../lib/folderTree";

export async function listFolders() {
  const db = await getDb();
  return db.getAllAsync(
    `SELECT f.*, COUNT(d.id) AS deck_count
     FROM folders f LEFT JOIN decks d ON d.folder_id = f.id
     GROUP BY f.id ORDER BY f.name COLLATE NOCASE`
  );
}

export async function getFolder(id) {
  const db = await getDb();
  return db.getFirstAsync("SELECT * FROM folders WHERE id = ?", [id]);
}

export async function createFolder(name, parentId = null) {
  const db = await getDb();
  return withDbTransaction(db, async (tx) => {
  if (parentId != null && !await tx.getFirstAsync("SELECT id FROM folders WHERE id = ?", [parentId])) throw new Error("La carpeta de destino ya no existe.");
  const res = await tx.runAsync("INSERT INTO folders (name, created_at, parent_id) VALUES (?, ?, ?)", [
    name.trim(),
    new Date().toISOString(),
    parentId,
  ]);
  return res.lastInsertRowId;
  });
}

export async function moveFolder(id, parentId) {
  const db = await getDb();
  return withDbTransaction(db, async (tx) => {
    const folders = await tx.getAllAsync("SELECT * FROM folders");
    if (!folders.some((folder) => folder.id === id) || !canMoveFolder(folders, id, parentId)) throw new Error("No podés mover una carpeta dentro de sí misma o de una subcarpeta.");
    await tx.runAsync("UPDATE folders SET parent_id = ? WHERE id = ?", [parentId, id]);
  });
}

export async function renameFolder(id, name) {
  const db = await getDb();
  await db.runAsync("UPDATE folders SET name = ? WHERE id = ?", [name.trim(), id]);
}

// Borra la carpeta dejando sus mazos sueltos (no se borra ningún mazo).
// folder_id no tiene FK real, así que la desasignación va en la misma
// transacción para que no queden mazos apuntando a una carpeta inexistente.
export async function deleteFolder(id) {
  const db = await getDb();
  await withDbTransaction(db, async (db) => {
    const folder = await db.getFirstAsync("SELECT parent_id FROM folders WHERE id = ?", [id]);
    await db.runAsync("UPDATE folders SET parent_id = ? WHERE parent_id = ?", [folder?.parent_id ?? null, id]);
    await db.runAsync("UPDATE decks SET folder_id = NULL WHERE folder_id = ?", [id]);
    await db.runAsync("DELETE FROM folders WHERE id = ?", [id]);
  });
}
