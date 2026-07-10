// Repositorio de prioridades mensuales (peso 1-3 por mazo o etiqueta). Async.

import { getDb } from "./client";

export async function listPriorities(month) {
  const db = await getDb();
  return db.getAllAsync("SELECT * FROM priorities WHERE month = ?", [month]);
}

// weight 1 = normal (se borra la fila), 2 = alta, 3 = máxima.
export async function setPriority(targetType, targetId, weight, month) {
  const db = await getDb();
  if (weight <= 1) {
    await db.runAsync(
      "DELETE FROM priorities WHERE target_type = ? AND target_id = ? AND month = ?",
      [targetType, targetId, month]
    );
    return;
  }
  await db.runAsync(
    `INSERT INTO priorities (target_type, target_id, weight, month) VALUES (?, ?, ?, ?)
     ON CONFLICT (target_type, target_id, month) DO UPDATE SET weight = excluded.weight`,
    [targetType, targetId, weight, month]
  );
}
