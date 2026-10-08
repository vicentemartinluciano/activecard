import { newCardState } from "../scheduler";
import { documentFromBackup, emptyDocument, mergeDocuments, validateDocument } from "../syncDocument";

const now = "2026-10-07T15:00:00.000Z";
const clone = (value) => JSON.parse(JSON.stringify(value));
function document() {
  const doc = emptyDocument();
  doc.folders.folder = { name: "Facultad", created_at: now };
  doc.decks.deck = { name: "Personas", created_at: now, priority: 100, icon: null, folder_id: "folder" };
  doc.cards.card = { deck_id: "deck", front: "Pregunta", back: "Respuesta", source: "manual", origin_card_id: null, created_at: now, ...newCardState(new Date(now)), starred: 0, suspended: 0, position: 1 };
  return doc;
}
test("rechaza tablas, columnas, relaciones y números fuera del contrato", () => {
  const doc = document();
  expect(validateDocument(doc)).toBe(doc);
  expect(() => validateDocument({ ...doc, settings: { openAIKey: "secreto" } })).toThrow();
  const column = clone(doc); column.cards.card.secret = "secreto";
  expect(() => validateDocument(column)).toThrow();
  const orphan = clone(doc); orphan.cards.card.deck_id = "inexistente";
  expect(() => validateDocument(orphan)).toThrow();
  const number = clone(doc); number.cards.card.reps = Infinity;
  expect(() => validateDocument(number)).toThrow();
});
test("combina ediciones de entidades distintas y conserva eliminaciones", () => {
  const base = document(); const local = clone(base); const remote = clone(base);
  local.decks.deck.name = "Nombre PC"; remote.cards.card.front = "Pregunta Android";
  const merged = mergeDocuments(base, local, remote);
  expect(merged.conflicts).toEqual([]);
  expect(merged.document.decks.deck.name).toBe("Nombre PC");
  expect(merged.document.cards.card.front).toBe("Pregunta Android");
  delete local.cards.card;
  const unchanged = mergeDocuments(base, local, base);
  expect(unchanged.document.cards).toEqual({});
});
test("dos repasos concurrentes mantienen programación e historial juntos y señalan recuperación", () => {
  const base = document(); const local = clone(base); const remote = clone(base);
  local.cards.card.reps = 1; remote.cards.card.reps = 2;
  local.review_logs.pc = { card_id: "card", rating: "again", mode: "daily", reviewed_at: now };
  remote.review_logs.android = { card_id: "card", rating: "good", mode: "daily", reviewed_at: now };
  const merged = mergeDocuments(base, local, remote);
  expect(merged.conflicts).toHaveLength(1);
  expect(merged.document.cards.card.reps).toBe(2);
  expect(merged.document.review_logs).toEqual(remote.review_logs);
  expect(local.review_logs.pc.rating).toBe("again");
});
test("el borrado concurrente de un mazo archiva los hijos editados", () => {
  const base = document(); const local = clone(base); const remote = clone(base);
  local.cards.card.front = "Texto que conservar en recuperación";
  delete remote.decks.deck; delete remote.cards.card;
  const merged = mergeDocuments(base, local, remote);
  expect(merged.conflicts.length).toBeGreaterThan(0);
  expect(merged.document.cards).toEqual({});
});
test("una conversación se conserva con sus mensajes sin combinar respuestas incompatibles", () => {
  const base = document();
  base.gym_chats.chat = { title: "Conversación", origin_card_id: "card", draft_text: "", created_at: now, updated_at: now };
  const local = clone(base); const remote = clone(base);
  local.gym_messages.pc = { chat_id: "chat", role: "user", text: "PC", metadata: null, created_at: now };
  remote.gym_messages.android = { chat_id: "chat", role: "user", text: "Android", metadata: null, created_at: now };
  const merged = mergeDocuments(base, local, remote);
  expect(merged.conflicts).toHaveLength(1);
  expect(merged.document.gym_messages).toEqual(remote.gym_messages);
});
test("un respaldo común conserva identidad aunque los IDs locales cambien", () => {
  const base = document();
  const backup = { folders: [{ id: 70, sync_id: "folder", ...base.folders.folder }], decks: [{ id: 80, sync_id: "deck", ...base.decks.deck, folder_id: 70 }], cards: [{ id: 90, sync_id: "card", ...base.cards.card, deck_id: 80 }], tags: [], deck_tags: [], review_logs: [], connections: [], gym_chats: [], gym_messages: [] };
  expect(documentFromBackup(backup)).toEqual(base);
});
