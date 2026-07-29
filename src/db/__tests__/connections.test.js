const rows = [];
const calls = [];

const db = {
  async getAllAsync(sql, params) {
    calls.push({ sql, params });
    return rows;
  },
};

jest.mock("../client", () => ({ getDb: jest.fn() }));

// eslint-disable-next-line import/first
import { getDb } from "../client";
// eslint-disable-next-line import/first
import { listConnectionsByHybridCard } from "../connections";

getDb.mockResolvedValue(db);

beforeEach(() => {
  rows.length = 0;
  calls.length = 0;
});

test("trae la charla y la tarjeta que originó la idea", async () => {
  rows.push({
    id: 1,
    card_id: 7,
    hybrid_card_id: 22,
    transcript: JSON.stringify([{ role: "user", text: "Mi conexión" }]),
    origin_front: "Pregunta original",
    origin_deck_id: 3,
  });

  const result = await listConnectionsByHybridCard(22);

  expect(result[0].transcript).toEqual([{ role: "user", text: "Mi conexión" }]);
  expect(result[0].origin_front).toBe("Pregunta original");
  expect(calls[0].params).toEqual([22]);
  expect(calls[0].sql).toContain("origin.id = cn.card_id");
});

test("un transcript viejo o inválido no rompe la pantalla", async () => {
  rows.push({ id: 2, transcript: "no-json" });
  expect((await listConnectionsByHybridCard(22))[0].transcript).toEqual([]);
});
