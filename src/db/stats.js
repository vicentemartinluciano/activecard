// Estadísticas derivadas de review_logs y cards. Sin estado propio ni tablas
// nuevas: se recalculan en cada consulta, igual que la racha y el progreso
// diario. Todo lo que se muestra en la pantalla Progreso sale de acá.
//
// ZONA HORARIA — la trampa de este módulo: `reviewed_at` y `due` se guardan con
// toISOString(), o sea en UTC, mientras que el resto de la app razona en hora
// LOCAL (startOfDay/endOfDay). Agrupar con substr(reviewed_at, 1, 10) mandaría
// un repaso de las 22:00 al día siguiente. Por eso el agrupado por día se hace
// en JS con new Date(...), nunca en SQL.

import { startOfDay } from "../lib/queue";
import { getDb } from "./client";

// Clave YYYY-MM-DD en hora local.
export function localDayKey(value) {
  const d = value instanceof Date ? value : new Date(value);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysAgo(n, now = new Date()) {
  const d = startOfDay(now);
  d.setDate(d.getDate() - n);
  return d;
}

// Retención = de cada 100 tarjetas repasadas, cuántas recordaste bien.
// Cuenta TODOS los modos (daily y quizlet): estudiar un mazo también es
// recordar. "Bien" es cualquier nota que no sea 'again' — "Más o menos" avanza.
// Ventana móvil de 30 días (no mes calendario) para que el número no se
// desplome cada primero de mes; el delta compara con los 30 días anteriores.
export async function getRetentionSummary(now = new Date()) {
  const db = await getDb();
  const desde = daysAgo(30, now).toISOString();
  const desdeAnterior = daysAgo(60, now).toISOString();

  const [actual, previo] = await Promise.all([
    db.getFirstAsync(
      `SELECT COUNT(*) AS total, SUM(rating != 'again') AS buenas
       FROM review_logs WHERE reviewed_at >= ?`,
      [desde]
    ),
    db.getFirstAsync(
      `SELECT COUNT(*) AS total, SUM(rating != 'again') AS buenas
       FROM review_logs WHERE reviewed_at >= ? AND reviewed_at < ?`,
      [desdeAnterior, desde]
    ),
  ]);

  const pctDe = (row) =>
    row && row.total > 0 ? Math.round(((row.buenas || 0) / row.total) * 100) : null;

  const pct = pctDe(actual);
  const anterior = pctDe(previo);
  return {
    pct,
    total: actual ? actual.total : 0,
    delta: pct != null && anterior != null ? pct - anterior : null,
  };
}

// Retención por semana, para el gráfico. Devuelve `weeks` puntos del más viejo
// al más nuevo; las semanas sin repasos quedan con pct null (la línea las
// interpola visualmente en vez de caer a cero, que sería mentira).
export async function getRetentionSeries(weeks = 12, now = new Date()) {
  const db = await getDb();
  const desde = daysAgo(weeks * 7, now);
  const rows = await db.getAllAsync(
    `SELECT reviewed_at, rating FROM review_logs WHERE reviewed_at >= ? ORDER BY reviewed_at ASC`,
    [desde.toISOString()]
  );

  const buckets = Array.from({ length: weeks }, (_, i) => {
    const inicio = new Date(desde);
    inicio.setDate(inicio.getDate() + i * 7);
    return { weekStart: localDayKey(inicio), total: 0, buenas: 0 };
  });

  for (const r of rows) {
    const diff = Math.floor((new Date(r.reviewed_at) - desde) / 86400000);
    const idx = Math.min(weeks - 1, Math.max(0, Math.floor(diff / 7)));
    buckets[idx].total++;
    if (r.rating !== "again") buckets[idx].buenas++;
  }

  return buckets.map((b) => ({
    weekStart: b.weekStart,
    n: b.total,
    pct: b.total > 0 ? Math.round((b.buenas / b.total) * 100) : null,
  }));
}

// Mapa de actividad de los últimos `days` días: { 'YYYY-MM-DD': cantidad }.
// Alimenta el heatmap de constancia.
export async function getActivityMap(days = 84, now = new Date()) {
  const db = await getDb();
  const desde = daysAgo(days - 1, now);
  const rows = await db.getAllAsync(
    `SELECT reviewed_at FROM review_logs WHERE reviewed_at >= ?`,
    [desde.toISOString()]
  );
  const map = {};
  for (const r of rows) {
    const k = localDayKey(r.reviewed_at);
    map[k] = (map[k] || 0) + 1;
  }
  return map;
}

// Cuántas tarjetas vencen cada uno de los próximos `days` días (hoy incluido).
// Excluye los mazos pausados: si el mazo está en 0%, sus tarjetas no van a
// aparecer y contarlas sería asustar al pedo. Todo lo vencido de antes se
// acumula en el primer día, que es como se va a sentir.
export async function getForecast(days = 7, now = new Date()) {
  const db = await getDb();
  const rows = await db.getAllAsync(
    `SELECT c.due AS due FROM cards c
     JOIN decks d ON d.id = c.deck_id
     WHERE d.priority > 0 AND c.suspended = 0`
  );

  const hoy = startOfDay(now);
  const out = Array.from({ length: days }, (_, i) => {
    const d = new Date(hoy);
    d.setDate(d.getDate() + i);
    return { day: localDayKey(d), date: d, count: 0 };
  });

  for (const r of rows) {
    const diff = Math.floor((startOfDay(new Date(r.due)) - hoy) / 86400000);
    if (diff < 0) out[0].count++; // atrasadas: pesan hoy
    else if (diff < days) out[diff].count++;
  }
  return out;
}

// Las tarjetas que más se te resisten. `lapses` lo viene manteniendo FSRS desde
// la primera versión y nunca se había leído.
export async function listWeakCards(limit = 20) {
  const db = await getDb();
  return db.getAllAsync(
    `SELECT c.*, d.name AS deck_name FROM cards c
     JOIN decks d ON d.id = c.deck_id
     WHERE c.lapses > 0 AND c.suspended = 0
     ORDER BY c.lapses DESC, c.id ASC
     LIMIT ?`,
    [limit]
  );
}

export async function countWeakCards() {
  const db = await getDb();
  const row = await db.getFirstAsync(
    "SELECT COUNT(*) AS n FROM cards WHERE lapses > 0 AND suspended = 0"
  );
  return row ? row.n : 0;
}

// Retención de UN mazo (pill del detalle). Misma ventana de 30 días.
export async function getDeckRetention(deckId, now = new Date()) {
  const db = await getDb();
  const desde = daysAgo(30, now).toISOString();
  const row = await db.getFirstAsync(
    `SELECT COUNT(*) AS total, SUM(rl.rating != 'again') AS buenas
     FROM review_logs rl JOIN cards c ON c.id = rl.card_id
     WHERE c.deck_id = ? AND rl.reviewed_at >= ?`,
    [deckId, desde]
  );
  if (!row || row.total === 0) return null;
  return Math.round(((row.buenas || 0) / row.total) * 100);
}
