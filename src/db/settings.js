// Repositorio de configuración simple (clave-valor). Async.

import { getDb } from "./client";

export async function listCardDrafts(deckId) {
  const db = await getDb();
  const prefix = `cardDraft:${deckId}:`;
  const rows = await db.getAllAsync("SELECT key,value FROM settings WHERE key LIKE ?", [`${prefix}%`]);
  return rows.flatMap((row) => {
    try {
      const value = JSON.parse(row.value);
      if (!value || typeof value.front !== "string" || typeof value.back !== "string") return [];
      return [{ ...value, keyId: row.key.slice(prefix.length) === "new" ? null : Number(row.key.slice(prefix.length)) }];
    } catch { return []; }
  });
}

export async function getSetting(key, fallback = null) {
  const db = await getDb();
  if (key === "dailyLimits") {
    const row = await db.getFirstAsync("SELECT max_reviews, max_new FROM study_preferences WHERE id = 1");
    return row ? { maxReviews: row.max_reviews, maxNew: row.max_new } : fallback;
  }
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
  if (key === "dailyLimits") {
    if (!Number.isInteger(value?.maxReviews) || value.maxReviews < 0 || value.maxReviews > 100 || !Number.isInteger(value?.maxNew) || value.maxNew < 0 || value.maxNew > 50) throw new Error("Los límites diarios no son válidos.");
    await db.runAsync("UPDATE study_preferences SET max_reviews = ?, max_new = ? WHERE id = 1", [value.maxReviews, value.maxNew]);
    return;
  }
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
    [key, JSON.stringify(value)]
  );
}
