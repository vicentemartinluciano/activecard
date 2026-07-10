// Conexión única a la base de datos local (expo-sqlite).
// Importar `getDb()` desde los repos; abre y migra una sola vez.

import { openDatabaseSync } from "expo-sqlite";

import { migrate } from "./schema";

let db = null;

export function getDb() {
  if (!db) {
    db = openDatabaseSync("activecard.db");
    db.execSync("PRAGMA foreign_keys = ON");
    migrate(db);
  }
  return db;
}

// Solo para tests o reinicio total: cierra y olvida la conexión.
export function resetDbConnection() {
  if (db) {
    try {
      db.closeSync();
    } catch (e) {
      // ya cerrada
    }
    db = null;
  }
}
