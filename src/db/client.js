// Conexión única a la base de datos local (expo-sqlite, API asíncrona).
// La API async funciona igual en Android y en web (la sync se cuelga en web),
// y en el teléfono no bloquea el hilo de UI.

import { openDatabaseAsync } from "expo-sqlite";

import { migrate } from "./schema";

let dbPromise = null;

export function getDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await openDatabaseAsync("activecard.db");
      await db.execAsync("PRAGMA foreign_keys = ON");
      await migrate(db);
      return db;
    })();
  }
  return dbPromise;
}

// Solo para tests o reinicio total: olvida la conexión.
export function resetDbConnection() {
  dbPromise = null;
}
