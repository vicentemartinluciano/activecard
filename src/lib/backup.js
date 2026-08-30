// Respaldo manual de datos (export/import): JSON con todo el contenido del
// usuario (mazos, tarjetas, conexiones). NO incluye `settings` — ahí viven
// las claves de API, que no deben viajar en un archivo que se comparte.

export const BACKUP_APP = "activecard";
// v2 agrega la tabla folders. Los respaldos v1 (sin folders) siguen siendo
// restaurables: se normalizan a folders vacío.
export const BACKUP_VERSION = 3;

// folders primero: aunque folder_id no tiene FK real, insertar padres antes
// que hijos es la convención del restore.
const TABLES = [
  "folders", "decks", "tags", "deck_tags", "cards", "review_logs", "connections",
  "gym_chats", "gym_messages",
];

// Orden de borrado al restaurar: hijos antes que padres (por las FKs).
const DELETE_ORDER = [
  "gym_messages", "gym_chats", "connections", "review_logs", "deck_tags",
  "cards", "tags", "decks", "folders",
];

function parseMessageMetadata(value) {
  if (!value) return null;
  try {
    return typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    return null;
  }
}

function sourcePayload(source) {
  return source?.base64 || source?.text || "";
}

// Identidad estable y corta para que una misma fuente adjuntada varias veces
// aparezca una sola vez en el selector del respaldo.
export function backupSourceKey(source) {
  const payload = sourcePayload(source);
  let hash = 2166136261;
  for (let i = 0; i < payload.length; i++) {
    hash ^= payload.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return [
    source?.name || "archivo",
    source?.mimeType || "application/octet-stream",
    source?.kind || "file",
    payload.length,
    (hash >>> 0).toString(16),
  ].join(":");
}

export function listSourcesFromMessages(rows = []) {
  const found = new Map();
  for (const row of rows) {
    const metadata = parseMessageMetadata(row.metadata);
    for (const source of metadata?.sources || []) {
      const key = backupSourceKey(source);
      const current = found.get(key);
      if (current) {
        current.occurrences += 1;
        continue;
      }
      const payload = sourcePayload(source);
      found.set(key, {
        key,
        name: source.name || "Archivo adjunto",
        mimeType: source.mimeType || "application/octet-stream",
        kind: source.kind || "file",
        sizeBytes: source.base64 ? Math.round((payload.length * 3) / 4) : payload.length,
        occurrences: 1,
      });
    }
  }
  return [...found.values()];
}

function filterMessageSources(rows, sourceKeys) {
  if (sourceKeys === undefined) return rows;
  const selected = new Set(sourceKeys);
  return rows.map((row) => {
    const metadata = parseMessageMetadata(row.metadata);
    if (!metadata?.sources?.length) return row;
    const sources = metadata.sources.filter((source) => selected.has(backupSourceKey(source)));
    const next = { ...metadata };
    if (sources.length) next.sources = sources;
    else delete next.sources;
    return { ...row, metadata: Object.keys(next).length ? JSON.stringify(next) : null };
  });
}

export async function buildBackup(db, now = new Date(), { sourceKeys } = {}) {
  const data = {};
  for (const table of TABLES) {
    data[table] = await db.getAllAsync(`SELECT * FROM ${table}`);
  }
  data.gym_messages = filterMessageSources(data.gym_messages, sourceKeys);
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
  if (![1, 2, BACKUP_VERSION].includes(backup.version)) {
    throw new Error(`Versión de respaldo no soportada (${backup.version}).`);
  }
  for (const table of TABLES) {
    // Un respaldo v1 no trae folders: es válido y se normaliza a [].
    if (table === "folders" && backup.version === 1 && backup[table] === undefined) continue;
    if (["gym_chats", "gym_messages"].includes(table) && backup.version < 3 && backup[table] === undefined) continue;
    if (!Array.isArray(backup[table])) {
      throw new Error(`El respaldo no tiene datos de "${table}".`);
    }
  }
}

// Reemplaza TODOS los datos actuales por los del respaldo (conserva los ids
// originales para no romper las relaciones). Devuelve un conteo por tabla.
export async function restoreBackup(db, backup) {
  validateBackup(backup);
  const data = {
    ...backup,
    folders: backup.folders || [],
    gym_chats: backup.gym_chats || [],
    gym_messages: backup.gym_messages || [],
  };

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
