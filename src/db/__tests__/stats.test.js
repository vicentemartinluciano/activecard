// El valor de stats.js está en el agrupado por día/semana en JS (para respetar
// la hora local pese a que las fechas se guardan en UTC) y en las ventanas de
// tiempo. Eso es lo que se testea: el fake devuelve filas y se verifica el
// resultado, más el contrato del SQL donde el criterio vive ahí.

const calls = [];
let firstRow = null;
let allRows = [];

const db = {
  async getFirstAsync(sql, params = []) {
    calls.push({ sql, params });
    return typeof firstRow === "function" ? firstRow(sql, params) : firstRow;
  },
  async getAllAsync(sql, params = []) {
    calls.push({ sql, params });
    return typeof allRows === "function" ? allRows(sql, params) : allRows;
  },
};

jest.mock("../client", () => ({ getDb: jest.fn() }));

// eslint-disable-next-line import/first
import { listAllCardsForSearch } from "../cards";
// eslint-disable-next-line import/first
import { getDb } from "../client";
// eslint-disable-next-line import/first
import {
  countWeakCards,
  getActivityMap,
  getDeckRetention,
  getForecast,
  getRetentionSeries,
  getRetentionSummary,
  listWeakCards,
  localDayKey,
} from "../stats";

getDb.mockResolvedValue(db);

// Fecha congelada: martes 28/07/2026, 12:00 hora local.
const NOW = new Date(2026, 6, 28, 12, 0, 0);

beforeEach(() => {
  calls.length = 0;
  firstRow = null;
  allRows = [];
});

describe("localDayKey", () => {
  test("usa el día LOCAL, no el UTC", () => {
    // 22:00 local del 28 sigue siendo el 28 aunque en UTC ya sea el 29.
    const nocheDelLunes = new Date(2026, 6, 28, 22, 30, 0);
    expect(localDayKey(nocheDelLunes)).toBe("2026-07-28");
    // Y el mismo instante pasado por ISO (UTC) no debe cambiar de día.
    expect(localDayKey(nocheDelLunes.toISOString())).toBe("2026-07-28");
  });

  test("rellena mes y día con cero", () => {
    expect(localDayKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("getRetentionSummary", () => {
  test("es el % de notas que NO fueron 'again', con delta contra el período previo", async () => {
    firstRow = (sql, params) =>
      params.length === 1
        ? { total: 100, buenas: 82 } // últimos 30 días
        : { total: 50, buenas: 38 }; // los 30 anteriores → 76%
    const r = await getRetentionSummary(NOW);
    expect(r.pct).toBe(82);
    expect(r.total).toBe(100);
    expect(r.delta).toBe(6);
  });

  test("sin repasos devuelve null en vez de 0% (0% sería mentira)", async () => {
    firstRow = { total: 0, buenas: null };
    const r = await getRetentionSummary(NOW);
    expect(r.pct).toBeNull();
    expect(r.delta).toBeNull();
  });

  test("cuenta TODOS los modos, no solo quizlet", async () => {
    firstRow = { total: 1, buenas: 1 };
    await getRetentionSummary(NOW);
    expect(calls[0].sql).not.toContain("mode");
    expect(calls[0].sql).toContain("rating != 'again'");
  });
});

describe("getRetentionSeries", () => {
  test("agrupa los repasos en semanas y calcula el % de cada una", async () => {
    const hace3Dias = new Date(NOW);
    hace3Dias.setDate(hace3Dias.getDate() - 3);
    allRows = [
      { reviewed_at: hace3Dias.toISOString(), rating: "good" },
      { reviewed_at: hace3Dias.toISOString(), rating: "again" },
      { reviewed_at: hace3Dias.toISOString(), rating: "hard" },
      { reviewed_at: hace3Dias.toISOString(), rating: "good" },
    ];
    const serie = await getRetentionSeries(4, NOW);
    expect(serie).toHaveLength(4);
    const ultima = serie[serie.length - 1];
    expect(ultima.n).toBe(4);
    expect(ultima.pct).toBe(75); // 3 de 4 no fueron 'again' ("hard" cuenta como buena)
  });

  test("las semanas sin repasos quedan en null, no en 0", async () => {
    allRows = [];
    const serie = await getRetentionSeries(3, NOW);
    expect(serie.every((s) => s.pct === null && s.n === 0)).toBe(true);
  });
});

describe("getActivityMap", () => {
  test("cuenta repasos por día local", async () => {
    const anoche = new Date(2026, 6, 27, 23, 15, 0);
    allRows = [
      { reviewed_at: anoche.toISOString() },
      { reviewed_at: anoche.toISOString() },
      { reviewed_at: new Date(2026, 6, 28, 9, 0, 0).toISOString() },
    ];
    const map = await getActivityMap(84, NOW);
    expect(map["2026-07-27"]).toBe(2);
    expect(map["2026-07-28"]).toBe(1);
  });
});

describe("getForecast", () => {
  test("reparte por día y acumula lo atrasado en hoy", async () => {
    allRows = [
      { due: new Date(2026, 6, 20, 8, 0).toISOString() }, // atrasada
      { due: new Date(2026, 6, 28, 23, 0).toISOString() }, // hoy
      { due: new Date(2026, 6, 30, 8, 0).toISOString() }, // en 2 días
      { due: new Date(2026, 7, 20, 8, 0).toISOString() }, // fuera de la ventana
    ];
    const f = await getForecast(7, NOW);
    expect(f).toHaveLength(7);
    expect(f[0].count).toBe(2); // la atrasada + la de hoy
    expect(f[2].count).toBe(1);
    expect(f.reduce((a, d) => a + d.count, 0)).toBe(3); // la lejana no entra
  });

  test("excluye los mazos pausados", async () => {
    allRows = [];
    await getForecast(7, NOW);
    expect(calls[0].sql).toContain("d.priority > 0");
    expect(calls[0].sql).toContain("c.suspended = 0");
  });
});

describe("puntos débiles", () => {
  test("ordena por lapses y solo trae las que fallaste alguna vez", async () => {
    allRows = [];
    await listWeakCards(5);
    expect(calls[0].sql).toContain("c.lapses > 0");
    expect(calls[0].sql).toContain("c.suspended = 0");
    expect(calls[0].sql).toContain("ORDER BY c.lapses DESC");
    expect(calls[0].params).toEqual([5]);
  });

  test("el contador usa el mismo criterio", async () => {
    firstRow = { n: 12 };
    expect(await countWeakCards()).toBe(12);
    expect(calls[0].sql).toContain("lapses > 0");
    expect(calls[0].sql).toContain("suspended = 0");
  });
});

describe("getDeckRetention", () => {
  test("acota al mazo y devuelve null si no hubo repasos", async () => {
    firstRow = { total: 0, buenas: null };
    expect(await getDeckRetention(7, NOW)).toBeNull();
    expect(calls[0].params[0]).toBe(7);
  });

  test("redondea el porcentaje del mazo", async () => {
    firstRow = { total: 9, buenas: 7 };
    expect(await getDeckRetention(7, NOW)).toBe(78);
  });
});

describe("listAllCardsForSearch", () => {
  test("recorta los bloques de imagen: el buscador necesita el texto, no las fotos", async () => {
    allRows = [];
    await listAllCardsForSearch();
    const { sql } = calls[calls.length - 1];
    // char(57360) es IMG_SENTINEL (\uE010): todo lo que va desde ahí es base64.
    expect(sql).toContain("char(57360)");
    expect(sql).toContain("substr(front");
    expect(sql).toContain("substr(back");
    // Y NO trae la tarjeta entera.
    expect(sql).not.toContain("SELECT *");
  });
});
