// Repositorio de configuración simple (clave-valor). Async.
// Usado por el Modo Enfoque, entre otros.

import { getDb } from "./client";

export async function getSetting(key, fallback = null) {
  const db = await getDb();
  const row = await db.getFirstAsync("SELECT value FROM settings WHERE key = ?", [key]);
  if (!row || row.value == null) return fallback;
  try {
    return JSON.parse(row.value);
  } catch (e) {
    return row.value;
  }
}

export async function setSetting(key, value) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
    [key, JSON.stringify(value)]
  );
}

// --- Modo Enfoque ---
// Guardado como lista de deck_ids; lista vacía o null = modo normal.

export function getFocusDeckIds() {
  return getSetting("focus_deck_ids", null);
}

export function setFocusDeckIds(deckIds) {
  return setSetting("focus_deck_ids", deckIds && deckIds.length > 0 ? deckIds : null);
}
