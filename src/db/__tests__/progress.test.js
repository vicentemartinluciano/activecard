const calls = [];

const db = {
  async getFirstAsync(sql) {
    calls.push(sql);
    return { n: 0 };
  },
  async getAllAsync(sql) {
    calls.push(sql);
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
  await getDeckDailyProgress(3, new Date("2026-07-29T12:00:00Z"));
  expect(calls.every((sql) => sql.includes("suspended = 0"))).toBe(true);
});

test("el progreso batch excluye tarjetas suspendidas de totales y realizadas", async () => {
  await getDecksDailyProgress(new Date("2026-07-29T12:00:00Z"));
  expect(calls.every((sql) => sql.includes("suspended = 0"))).toBe(true);
});

test("el pool de estudio de mazo nunca devuelve suspendidas", async () => {
  await listDeckCardsNotReviewedToday(3, new Date("2026-07-29T12:00:00Z"));
  expect(calls[0]).toContain("suspended = 0");
});
