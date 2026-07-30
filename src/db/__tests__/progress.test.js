const calls = [];

const db = {
  async getFirstAsync(sql, params = []) {
    calls.push({ sql, params });
    return { n: sql.includes("COUNT(*) AS n FROM cards") ? 3 : 1 };
  },
  async getAllAsync(sql, params = []) {
    calls.push({ sql, params });
    return [];
  },
};

jest.mock("../client", () => ({ getDb: jest.fn() }));

// eslint-disable-next-line import/first
import { getDb } from "../client";
// eslint-disable-next-line import/first
import {
  getDeckDailyProgress,
  getDecksDailyProgress,
  listDeckCardsNotReviewedToday,
} from "../progress";

getDb.mockResolvedValue(db);

beforeEach(() => {
  calls.length = 0;
});

test("el progreso de un mazo excluye tarjetas suspendidas", async () => {
  const progress = await getDeckDailyProgress(3, new Date("2026-07-29T12:00:00Z"));
  expect(progress).toEqual({ reviewedToday: 1, total: 3, pct: 33 });
  expect(calls.every(({ sql }) => sql.includes("suspended = 0"))).toBe(true);
  const doneQuery = calls.find(({ sql }) => sql.includes("review_logs"));
  expect(doneQuery.sql).toContain("rl.rating != 'again'");
  expect(doneQuery.sql).toContain("SELECT MAX(id)");
  expect(doneQuery.params[0]).toBe(doneQuery.params[1]);
});

test("el progreso batch excluye tarjetas suspendidas de totales y realizadas", async () => {
  await getDecksDailyProgress(new Date("2026-07-29T12:00:00Z"));
  expect(calls.every(({ sql }) => sql.includes("suspended = 0"))).toBe(true);
  const doneQuery = calls.find(({ sql }) => sql.includes("review_logs"));
  expect(doneQuery.params[0]).toBe(doneQuery.params[1]);
});

test("el pool de estudio de mazo nunca devuelve suspendidas", async () => {
  await listDeckCardsNotReviewedToday(3, new Date("2026-07-29T12:00:00Z"));
  expect(calls[0].sql).toContain("suspended = 0");
  expect(calls[0].sql).toContain("rl.rating != 'again'");
  expect(calls[0].params[1]).toBe(calls[0].params[2]);
});
