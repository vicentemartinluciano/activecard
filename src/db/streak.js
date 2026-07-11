// Racha diaria — repositorio. La lógica de conteo vive en src/lib/streak.js
// (pura, testeada); acá solo se trae la lista de días con actividad.

import { countStreak } from "../lib/streak";
import { getDb } from "./client";

export async function getStreak(now = new Date()) {
  const db = await getDb();
  const rows = await db.getAllAsync(
    "SELECT DISTINCT date(reviewed_at, 'localtime') AS d FROM review_logs ORDER BY d DESC"
  );
  return countStreak(rows.map((r) => r.d), now);
}
