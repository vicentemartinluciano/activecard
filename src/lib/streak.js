// Lógica pura de la racha diaria: ≥1 tarjeta repasada por día (cualquier
// modo) la mantiene; un día sin repasos la corta. Derivada de review_logs,
// sin tabla propia — el conteo se calcula a partir de la lista de días con
// actividad (fechas locales 'YYYY-MM-DD', orden desc, sin duplicados).

function toDateStr(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dateStrMinusDays(dateStr, n) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() - n);
  return toDateStr(date);
}

// datesDesc: array de 'YYYY-MM-DD' con al menos un repaso, sin duplicados,
// orden descendente (más reciente primero) — así es como conviene traerlas
// de SQL (`SELECT DISTINCT date(...) ... ORDER BY d DESC`).
// now: instante actual, para saber si "hoy" está entre los días activos.
export function countStreak(datesDesc, now = new Date()) {
  const today = toDateStr(now);
  const set = new Set(datesDesc);
  const activeToday = set.has(today);

  // La racha arranca hoy si ya repasaste, o ayer si todavía no repasaste hoy
  // pero la venías sosteniendo (para no "cortarla" antes de que termine el día).
  let cursor = activeToday ? today : dateStrMinusDays(today, 1);
  if (!set.has(cursor)) {
    return { days: 0, activeToday };
  }

  let days = 0;
  while (set.has(cursor)) {
    days++;
    cursor = dateStrMinusDays(cursor, 1);
  }
  return { days, activeToday };
}
