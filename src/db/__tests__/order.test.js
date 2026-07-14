import { createCard, listCardsByDeck, setCardPositions, setCardStarred } from "../cards";

// Doble mínimo de una conexión expo-sqlite async (patrón de undo.test.js),
// con soporte para la subquery de position del INSERT y el orden manual.
function fakeDb() {
  const cards = new Map();
  let nextId = 1;

  return {
    cards,
    async execAsync() {
      // BEGIN/COMMIT/ROLLBACK: no-op en el doble.
    },
    async runAsync(sql, params = []) {
      if (sql.startsWith("INSERT INTO cards")) {
        const id = nextId++;
        const deckId = params[0];
        const positions = [...cards.values()]
          .filter((c) => c.deck_id === deckId)
          .map((c) => c.position);
        const row = {
          id,
          deck_id: deckId,
          front: params[1],
          back: params[2],
          starred: 0,
          position: Math.max(0, ...positions) + 1,
        };
        cards.set(id, row);
        return { lastInsertRowId: id };
      }
      if (sql.startsWith("UPDATE cards SET starred")) {
        cards.get(params[1]).starred = params[0];
        return {};
      }
      if (sql.startsWith("UPDATE cards SET position")) {
        const [pos, id, deckId] = params;
        const row = cards.get(id);
        if (row && row.deck_id === deckId) row.position = pos;
        return {};
      }
      throw new Error(`sql no soportado por el doble: ${sql}`);
    },
    async getAllAsync(sql, params = []) {
      if (sql.includes("FROM cards WHERE deck_id")) {
        return [...cards.values()]
          .filter((c) => c.deck_id === params[0])
          .sort((a, b) => a.position - b.position || a.id - b.id);
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

describe("orden manual y estrellas de tarjetas", () => {
  test("createCard asigna posiciones incrementales; setCardPositions reordena; setCardStarred persiste", async () => {
    const a = await createCard({ deckId: 1, front: "A", back: "a" });
    const b = await createCard({ deckId: 1, front: "B", back: "b" });
    const c = await createCard({ deckId: 1, front: "C", back: "c" });

    expect(db.cards.get(a).position).toBe(1);
    expect(db.cards.get(b).position).toBe(2);
    expect(db.cards.get(c).position).toBe(3);

    await setCardPositions(1, [c, b, a]);
    const ordered = await listCardsByDeck(1);
    expect(ordered.map((x) => x.id)).toEqual([c, b, a]);

    await setCardStarred(b, 1);
    expect(db.cards.get(b).starred).toBe(1);
    await setCardStarred(b, 0);
    expect(db.cards.get(b).starred).toBe(0);
  });
});
