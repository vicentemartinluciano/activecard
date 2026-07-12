// Repositorio de carpetas (API asíncrona). Una carpeta agrupa mazos:
// cada mazo pertenece a 0 o 1 carpeta (decks.folder_id).

import { getDb } from "./client";

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

export async function createFolder(name) {
  const db = await getDb();
  const res = await db.runAsync("INSERT INTO folders (name, created_at) VALUES (?, ?)", [
    name.trim(),
    new Date().toISOString(),
  ]);
  return res.lastInsertRowId;
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
  await db.execAsync("BEGIN");
  try {
    await db.runAsync("UPDATE decks SET folder_id = NULL WHERE folder_id = ?", [id]);
    await db.runAsync("DELETE FROM folders WHERE id = ?", [id]);
    await db.execAsync("COMMIT");
  } catch (e) {
    await db.execAsync("ROLLBACK");
    throw e;
  }
}
