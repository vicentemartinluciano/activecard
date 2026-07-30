const calls = [];

const db = {
  async getAllAsync(sql) {
    calls.push(sql);
    return [{ d: "2026-07-29" }, { d: "2026-07-28" }];
  },
};

jest.mock("../client", () => ({ getDb: jest.fn() }));

// eslint-disable-next-line import/first
import { getDb } from "../client";
// eslint-disable-next-line import/first
import { getStreak } from "../streak";

getDb.mockResolvedValue(db);

test("la racha agrupa review_logs por día local y mantiene el mismo criterio del heatmap", async () => {
  const result = await getStreak(new Date(2026, 6, 29, 20, 0));

  expect(result).toEqual({ days: 2, activeToday: true });
  expect(calls[0]).toContain("date(reviewed_at, 'localtime')");
  expect(calls[0]).toContain("ORDER BY d DESC");
});
