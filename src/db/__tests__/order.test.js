import {
  createCard,
  listRecentReviews,
  listCardsByDeck,
  setCardDeck,
  setCardPositions,
  setCardStarred,
  setCardSuspended,
  updateCardText,
} from "../cards";

// Doble mínimo de una conexión expo-sqlite async (patrón de undo.test.js),
// con soporte para la subquery de position del INSERT y el orden manual.
function fakeDb() {
  const cards = new Map();
  const reviews = [
    { id: 1, card_id: 1, rating: "again", mode: "daily", reviewed_at: "2026-07-01" },
    { id: 2, card_id: 1, rating: "good", mode: "daily", reviewed_at: "2026-07-02" },
  ];
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
          source: params[3],
          starred: 0,
          suspended: 0,
          position: Math.max(0, ...positions) + 1,
        };
        cards.set(id, row);
        return { lastInsertRowId: id };
      }
      if (sql.startsWith("UPDATE cards SET starred")) {
        cards.get(params[1]).starred = params[0];
        return {};
      }
      if (sql.startsWith("UPDATE cards SET suspended")) {
        cards.get(params[1]).suspended = params[0];
        return {};
      }
      if (sql.startsWith("UPDATE cards SET front")) {
        const id = params[2];
        const row = cards.get(id);
        row.front = params[0];
        row.back = params[1];
        if (sql.includes("source = CASE") && row.source === "ai") row.source = "manual";
        return {};
      }
      if (sql.startsWith("UPDATE cards SET deck_id")) {
        const [deckId, , id] = params;
        const row = cards.get(id);
        const positions = [...cards.values()]
          .filter((card) => card.deck_id === deckId)
          .map((card) => card.position);
        row.deck_id = deckId;
        row.position = Math.max(0, ...positions) + 1;
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
      if (sql.includes("FROM review_logs")) {
        return reviews
          .filter((review) => review.card_id === params[0])
          .sort((a, b) => b.id - a.id)
          .slice(0, params[1]);
      }
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

    await setCardSuspended(c, 1);
    expect(db.cards.get(c).suspended).toBe(1);
    await setCardSuspended(c, 0);
    expect(db.cards.get(c).suspended).toBe(0);
  });

  test("mueve tarjetas, marca una edición de IA como revisada y lista notas recientes", async () => {
    const ai = await createCard({ deckId: 1, front: "Original", back: "D", source: "ai" });
    await updateCardText(ai, "Revisada", "Dorso", { markReviewed: true });
    expect(db.cards.get(ai)).toMatchObject({
      front: "Revisada",
      back: "Dorso",
      source: "manual",
    });

    await setCardDeck(ai, 2);
    expect(db.cards.get(ai).deck_id).toBe(2);
    expect(db.cards.get(ai).position).toBe(1);

    const reviews = await listRecentReviews(1, 1);
    expect(reviews).toHaveLength(1);
    expect(reviews[0].rating).toBe("good");
  });
});
