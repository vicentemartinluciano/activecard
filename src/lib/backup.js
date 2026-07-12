// Respaldo manual de datos (export/import): JSON con todo el contenido del
// usuario (mazos, tarjetas, conexiones). NO incluye `settings` — ahí viven
// las claves de API, que no deben viajar en un archivo que se comparte.

export const BACKUP_APP = "activecard";
// v2 agrega la tabla folders. Los respaldos v1 (sin folders) siguen siendo
// restaurables: se normalizan a folders vacío.
export const BACKUP_VERSION = 2;

// folders primero: aunque folder_id no tiene FK real, insertar padres antes
// que hijos es la convención del restore.
const TABLES = ["folders", "decks", "tags", "deck_tags", "cards", "review_logs", "connections"];

// Orden de borrado al restaurar: hijos antes que padres (por las FKs).
const DELETE_ORDER = ["connections", "review_logs", "deck_tags", "cards", "tags", "decks", "folders"];

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
  if (backup.version !== 1 && backup.version !== BACKUP_VERSION) {
    throw new Error(`Versión de respaldo no soportada (${backup.version}).`);
  }
  for (const table of TABLES) {
    // Un respaldo v1 no trae folders: es válido y se normaliza a [].
    if (table === "folders" && backup.version === 1 && backup[table] === undefined) continue;
    if (!Array.isArray(backup[table])) {
      throw new Error(`El respaldo no tiene datos de "${table}".`);
    }
  }
}

// Reemplaza TODOS los datos actuales por los del respaldo (conserva los ids
// originales para no romper las relaciones). Devuelve un conteo por tabla.
export async function restoreBackup(db, backup) {
  validateBackup(backup);
  const data = { ...backup, folders: backup.folders || [] };

  await db.execAsync("BEGIN");
  try {
    for (const table of DELETE_ORDER) {
      await db.execAsync(`DELETE FROM ${table}`);
    }
    for (const table of TABLES) {
      for (const row of data[table]) {
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
  for (const table of TABLES) counts[table] = data[table].length;
  return counts;
}
