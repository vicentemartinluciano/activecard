import { buildDeckExport } from "../deckExport";
import { normalizeBackup } from "../backup";

test("compartir un mazo exporta solo contenido y reinicia identidades y programación", async () => {
  const now = new Date("2026-10-16T12:00:00.000Z");
  const db = {
    getFirstAsync: jest.fn(async () => ({ id: 8, sync_id: "privado", name: "Mazo", icon: "book", folder_id: 6 })),
    getAllAsync: jest.fn(async (sql) => sql.includes("FROM cards") ? [{ id: 91, deck_id: 8, front: "Pregunta", back: "Respuesta", reps: 200, sync_id: "privado", origin_card_id: 7 }] : [{ id: 15, name: "Tema" }]),
  };
  const shared = await buildDeckExport(db, 8, now);
  expect(() => normalizeBackup(shared)).not.toThrow();
  expect(shared.cards[0]).toMatchObject({ deck_id: 1, reps: 0, state: 0, origin_card_id: null, front: "Pregunta", back: "Respuesta" });
  expect(shared.cards[0].due).toBe(now.toISOString());
  expect(shared.deck_tags).toEqual([{ deck_id: 1, tag_id: 1 }]);
  expect(shared.folders).toEqual([]);
  expect(shared.review_logs).toEqual([]);
  expect(shared.gym_chats).toEqual([]);
  expect(JSON.stringify(shared)).not.toContain("privado");
  expect(db.getAllAsync.mock.calls.every(([, params]) => params[0] === 8)).toBe(true);
});
