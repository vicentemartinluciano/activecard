// Conexión única a la base de datos local (expo-sqlite, API asíncrona).
// La API async funciona igual en Android y en web (la sync se cuelga en web),
// y en el teléfono no bloquea el hilo de UI.

import { openDatabaseAsync } from "expo-sqlite";

import { migrate } from "./schema";

let dbPromise = null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// En web, al recargar la página el worker viejo puede tardar en soltar el
// lock del archivo OPFS. Esto aparece con más de un mensaje de error
// distinto según en qué momento de la carrera se pise (visto en pruebas
// reales): "Access Handles cannot be created…" y, justo después, "Invalid
// VFS state". Reintentar ante cualquiera de los dos cubre la carrera.
const TRANSIENT_ERRORS = ["Access Handle", "Invalid VFS state"];

async function openWithRetry() {
  let lastError = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      return await openDatabaseAsync("activecard.db");
    } catch (e) {
      lastError = e;
      console.warn(`[db] apertura intento ${attempt + 1} falló:`, String(e));
      if (!TRANSIENT_ERRORS.some((msg) => String(e).includes(msg))) throw e;
      await sleep(400 * (attempt + 1));
    }
  }
  throw lastError;
}

export function getDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await openWithRetry();
      await db.execAsync("PRAGMA foreign_keys = ON");
      await migrate(db);
      return db;
    })();
    // Si la apertura falla, no dejar cacheado el rechazo: el próximo getDb()
    // debe poder reintentar (p. ej. cuando el lock de OPFS ya se liberó).
    dbPromise.catch(() => {
      dbPromise = null;
    });
  }
  return dbPromise;
}

// Solo para tests o reinicio total: olvida la conexión.
export function resetDbConnection() {
  dbPromise = null;
}
