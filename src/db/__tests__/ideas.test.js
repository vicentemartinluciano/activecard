import { listDecksWithIdeas, listIdeaCards } from "../cards";

// listDecksWithIdeas/listIdeaCards son consultas puras (el criterio vive en el
// SQL, no en JS). El doble captura sql+params y se asserta el contrato, al
// estilo de schema.test.js — reimplementar el GROUP BY sería testear el fake.
const calls = [];
const db = {
  async getAllAsync(sql, params = []) {
    calls.push({ sql, params });
    return [];
  },
};

jest.mock("../client", () => ({
  getDb: jest.fn(),
}));

// eslint-disable-next-line import/first
import { getDb } from "../client";
getDb.mockResolvedValue(db);

beforeEach(() => {
  calls.length = 0;
});

describe("listDecksWithIdeas", () => {
  test("deriva de cards hybrid, con conteo/fecha y sueltos primero", async () => {
    await listDecksWithIdeas();
    const { sql } = calls[0];
    expect(sql).toContain("source = 'hybrid'");
    expect(sql).toContain("COUNT(c.id) AS idea_count");
    expect(sql).toContain("MAX(c.created_at) AS last_idea_at");
    expect(sql).toContain("d.folder_id");
    expect(sql).toMatch(/ORDER BY\s*\(d\.folder_id IS NOT NULL\),\s*d\.name/);
  });
});

describe("listIdeaCards", () => {
  test("filtra por mazo y source, más reciente primero", async () => {
    await listIdeaCards(42);
    const { sql, params } = calls[0];
    expect(sql).toContain("source = 'hybrid'");
    expect(sql).toContain("ORDER BY created_at DESC");
    expect(params).toEqual([42]);
  });
});
