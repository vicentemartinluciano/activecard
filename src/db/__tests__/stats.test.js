// El valor de stats.js está en el agrupado por día/semana en JS (para respetar
// la hora local pese a que las fechas se guardan en UTC) y en las ventanas de
// tiempo. Eso es lo que se testea: el fake devuelve filas y se verifica el
// resultado, más el contrato del SQL donde el criterio vive ahí.

import { DatabaseSync } from "node:sqlite";

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
  getDeckRecallScore,
  getForecast,
  getRecallScoreSeries,
  getRecallScoreSummary,
  listWeakCards,
  localDayKey,
} from "../stats";

getDb.mockResolvedValue(db);

// Fecha congelada: martes 28/07/2026, 12:00 hora local.
const NOW = new Date(2026, 6, 28, 12, 0, 0);

// Ejecuta las consultas de producción en SQLite real para comprobar los pesos,
// las ventanas temporales y el filtro por mazo, además del agrupado en JS.
function reviewFixture() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`
    CREATE TABLE cards (id INTEGER PRIMARY KEY, deck_id INTEGER);
    CREATE TABLE review_logs (card_id INTEGER, rating TEXT, reviewed_at TEXT);
    INSERT INTO cards VALUES (1, 7), (2, 8);
  `);
  firstRow = (sql, params) => sqlite.prepare(sql).get(...params);
  allRows = (sql, params) => sqlite.prepare(sql).all(...params);
  const insert = sqlite.prepare("INSERT INTO review_logs VALUES (?, ?, ?)");
  return {
    add(rating, count, daysBack = 3, cardId = 1) {
      const date = new Date(NOW);
      date.setDate(date.getDate() - daysBack);
      for (let i = 0; i < count; i++)
        insert.run(cardId, rating, date.toISOString());
    },
    close: () => sqlite.close(),
  };
}

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

describe("getRecallScoreSummary", () => {
  test("calcula el puntaje y el delta contra el período previo", async () => {
    firstRow = (sql, params) =>
      params.length === 1
        ? { total: 100, points: 82 } // últimos 30 días
        : { total: 50, points: 38 }; // los 30 anteriores → 76/100
    const r = await getRecallScoreSummary(NOW);
    expect(r.score).toBe(82);
    expect(r.total).toBe(100);
    expect(r.delta).toBe(6);
  });

  test("sin repasos devuelve null en vez de un puntaje de 0", async () => {
    firstRow = { total: 0, points: null };
    const r = await getRecallScoreSummary(NOW);
    expect(r.score).toBeNull();
    expect(r.delta).toBeNull();
  });

  test("cuenta TODOS los modos, no solo quizlet", async () => {
    firstRow = { total: 1, points: 1 };
    await getRecallScoreSummary(NOW);
    expect(calls[0].sql).not.toContain("mode");
    expect(calls[0].sql).toContain("WHEN 'hard' THEN 0.5");
  });
});

describe("puntaje ponderado sobre el historial en SQLite", () => {
  test.each([
    ["good", 100],
    ["hard", 50],
    ["again", 0],
  ])(
    "%s produce %i sobre 100 en resumen, semana y mazo",
    async (rating, expected) => {
      const fixture = reviewFixture();
      try {
        fixture.add(rating, 1);
        expect((await getRecallScoreSummary(NOW)).score).toBe(expected);
        expect((await getRecallScoreSeries(12, NOW)).at(-1)).toMatchObject({
          score: expected,
          n: 1,
        });
        expect(await getDeckRecallScore(7, NOW)).toBe(expected);
      } finally {
        fixture.close();
      }
    },
  );

  test("60 Good + 20 Hard + 20 Again dan 70; compara ambos períodos con el mismo criterio", async () => {
    const fixture = reviewFixture();
    try {
      fixture.add("good", 60);
      fixture.add("hard", 20);
      fixture.add("again", 20);
      fixture.add("good", 40, 40);
      fixture.add("hard", 40, 40);
      fixture.add("again", 20, 40);
      expect(await getRecallScoreSummary(NOW)).toEqual({
        score: 70,
        total: 100,
        delta: 10,
      });
      const serie = await getRecallScoreSeries(12, NOW);
      expect(serie.at(-1)).toMatchObject({ score: 70, n: 100 });
      expect(
        serie.filter((week) => week.n > 0).map((week) => week.score),
      ).toEqual([60, 70]);
      expect(await getDeckRecallScore(7, NOW)).toBe(70);
    } finally {
      fixture.close();
    }
  });

  test("el mazo filtra sus propios repasos y distingue falta de datos de fallos", async () => {
    const fixture = reviewFixture();
    try {
      fixture.add("hard", 1);
      expect(await getDeckRecallScore(8, NOW)).toBeNull();
      fixture.add("again", 1, 3, 2);
      expect(await getDeckRecallScore(7, NOW)).toBe(50);
      expect(await getDeckRecallScore(8, NOW)).toBe(0);
      expect((await getRecallScoreSummary(NOW)).score).toBe(25);
    } finally {
      fixture.close();
    }
  });
});

describe("getRecallScoreSeries", () => {
  test("agrupa los repasos en semanas con Hard a medio punto", async () => {
    const hace3Dias = new Date(NOW);
    hace3Dias.setDate(hace3Dias.getDate() - 3);
    allRows = [
      { reviewed_at: hace3Dias.toISOString(), rating: "good" },
      { reviewed_at: hace3Dias.toISOString(), rating: "again" },
      { reviewed_at: hace3Dias.toISOString(), rating: "hard" },
      { reviewed_at: hace3Dias.toISOString(), rating: "good" },
    ];
    const serie = await getRecallScoreSeries(4, NOW);
    expect(serie).toHaveLength(4);
    const ultima = serie[serie.length - 1];
    expect(ultima.n).toBe(4);
    expect(ultima.score).toBe(63); // (1 + 0 + 0,5 + 1) / 4 = 62,5 → 63
  });

  test("las semanas sin repasos quedan en null, no en 0", async () => {
    allRows = [];
    const serie = await getRecallScoreSeries(3, NOW);
    expect(serie.every((s) => s.score === null && s.n === 0)).toBe(true);
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

describe("getDeckRecallScore", () => {
  test("acota al mazo y devuelve null si no hubo repasos", async () => {
    firstRow = { total: 0, points: null };
    expect(await getDeckRecallScore(7, NOW)).toBeNull();
    expect(calls[0].params[0]).toBe(7);
  });

  test("redondea el puntaje del mazo", async () => {
    firstRow = { total: 9, points: 7 };
    expect(await getDeckRecallScore(7, NOW)).toBe(78);
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
