// Respaldo manual de datos (export/import): JSON con todo el contenido del
// usuario (mazos, tarjetas, conexiones). NO incluye `settings` — ahí viven
// las claves de API, que no deben viajar en un archivo que se comparte.

export const BACKUP_APP = "activecard";
export const BACKUP_VERSION = 1;

const TABLES = ["decks", "tags", "deck_tags", "cards", "review_logs", "connections"];

// Orden de borrado al restaurar: hijos antes que padres (por las FKs).
const DELETE_ORDER = ["connections", "review_logs", "deck_tags", "cards", "tags", "decks"];

export async function buildBackup(db, now = new Date()) {
  const data = {};
  for (const table of TABLES) {
    data[table] = await db.getAllAsync(`SELECT * FROM ${table}`);
  }
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    ...data,
  };
}

function validateBackup(backup) {
  if (!backup || typeof backup !== "object") {
    throw new Error("El archivo no tiene un formato válido.");
  }
  if (backup.app !== BACKUP_APP) {
    throw new Error("Este archivo no es un respaldo de ActiveCard.");
  }
  if (backup.version !== BACKUP_VERSION) {
    throw new Error(`Versión de respaldo no soportada (${backup.version}).`);
  }
  for (const table of TABLES) {
    if (!Array.isArray(backup[table])) {
      throw new Error(`El respaldo no tiene datos de "${table}".`);
    }
  }
}

// Reemplaza TODOS los datos actuales por los del respaldo (conserva los ids
// originales para no romper las relaciones). Devuelve un conteo por tabla.
export async function restoreBackup(db, backup) {
  validateBackup(backup);

  await db.execAsync("BEGIN");
  try {
    for (const table of DELETE_ORDER) {
      await db.execAsync(`DELETE FROM ${table}`);
    }
    for (const table of TABLES) {
      for (const row of backup[table]) {
        const cols = Object.keys(row);
        const placeholders = cols.map(() => "?").join(", ");
        await db.runAsync(
          `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${placeholders})`,
          cols.map((c) => row[c])
        );
      }
    }
    await db.execAsync("COMMIT");
  } catch (e) {
    await db.execAsync("ROLLBACK");
    throw e;
  }

  const counts = {};
  for (const table of TABLES) counts[table] = backup[table].length;
  return counts;
}
