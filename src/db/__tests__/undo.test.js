import { createCard, reviewCard, snapshotFsrs, undoReview } from "../cards";

// Doble mínimo de una conexión expo-sqlite async con tablas en memoria,
// suficiente para las consultas exactas que usa db/cards.js.
function fakeDb() {
  const cards = new Map();
  const reviewLogs = new Map();
  let nextCardId = 1;
  let nextLogId = 1;

  return {
    cards,
    reviewLogs,
    async runAsync(sql, params = []) {
      if (sql.startsWith("INSERT INTO cards")) {
        const cols = /\(([^)]+)\)\s*VALUES/.exec(sql)[1].split(",").map((c) => c.trim());
        const row = {};
        cols.forEach((c, i) => (row[c] = params[i]));
        const id = nextCardId++;
        row.id = id;
        cards.set(id, row);
        return { lastInsertRowId: id };
      }
      if (sql.startsWith("UPDATE cards SET")) {
        const setCols = [...sql.matchAll(/(\w+) = \?/g)].map((m) => m[1]);
        const id = params[params.length - 1];
        const row = cards.get(id);
        setCols.forEach((c, i) => (row[c] = params[i]));
        return {};
      }
      if (sql.startsWith("INSERT INTO review_logs")) {
        const cols = /\(([^)]+)\)\s*VALUES/.exec(sql)[1].split(",").map((c) => c.trim());
        const row = {};
        cols.forEach((c, i) => (row[c] = params[i]));
        const id = nextLogId++;
        row.id = id;
        reviewLogs.set(id, row);
        return { lastInsertRowId: id };
      }
      if (sql.startsWith("DELETE FROM review_logs")) {
        reviewLogs.delete(params[0]);
        return {};
      }
      throw new Error(`sql no soportado por el doble: ${sql}`);
    },
  };
}

const db = fakeDb();

jest.mock("../client", () => ({
  getDb: jest.fn(),
}));

// eslint-disable-next-line import/first
import { getDb } from "../client";
getDb.mockResolvedValue(db);

describe("deshacer un repaso (snapshotFsrs + undoReview)", () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-07-13T12:00:00Z"));
  });

  test("reviewCard cambia el estado FSRS y deja un review_log; undoReview lo revierte exacto", async () => {
    const id = await createCard({ deckId: 1, front: "¿Capital de Francia?", back: "París" });
    const before = db.cards.get(id);
    const prev = snapshotFsrs(before);

    const updated = await reviewCard(before, "good", "daily");

    expect(db.reviewLogs.size).toBe(1);
    expect(typeof updated.logId).toBe("number");
    const afterReview = db.cards.get(id);
    expect(afterReview.reps).toBe(1);
    expect(afterReview.state).not.toBe(prev.state);

    await undoReview(id, prev, updated.logId);

    expect(db.reviewLogs.size).toBe(0);
    const restored = db.cards.get(id);
    expect(snapshotFsrs(restored)).toEqual(prev);
  });
});
