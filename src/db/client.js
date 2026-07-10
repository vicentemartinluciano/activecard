// Conexión única a la base de datos local (expo-sqlite, API asíncrona).
// La API async funciona igual en Android y en web (la sync se cuelga en web),
// y en el teléfono no bloquea el hilo de UI.

import { openDatabaseAsync } from "expo-sqlite";

import { migrate } from "./schema";

let dbPromise = null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function openWithRetry() {
  // En web, al recargar la página el worker viejo puede tardar en soltar el
  // lock del archivo (OPFS: "Access Handles cannot be created…"). Reintentar
  // unas veces antes de rendirse cubre esa carrera.
  let lastError = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await openDatabaseAsync("activecard.db");
    } catch (e) {
      lastError = e;
      console.warn(`[db] apertura intento ${attempt + 1} falló:`, String(e));
      if (!String(e).includes("Access Handle")) throw e;
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
