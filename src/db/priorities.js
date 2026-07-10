// Repositorio de prioridades mensuales (peso 1-3 por mazo o etiqueta).

import { getDb } from "./client";

export function listPriorities(month) {
  return getDb().getAllSync("SELECT * FROM priorities WHERE month = ?", [month]);
}

// weight 1 = normal (se borra la fila), 2 = alta, 3 = máxima.
export function setPriority(targetType, targetId, weight, month) {
  const db = getDb();
  if (weight <= 1) {
    db.runSync(
      "DELETE FROM priorities WHERE target_type = ? AND target_id = ? AND month = ?",
      [targetType, targetId, month]
    );
    return;
  }
  db.runSync(
    `INSERT INTO priorities (target_type, target_id, weight, month) VALUES (?, ?, ?, ?)
     ON CONFLICT (target_type, target_id, month) DO UPDATE SET weight = excluded.weight`,
    [targetType, targetId, weight, month]
  );
}
