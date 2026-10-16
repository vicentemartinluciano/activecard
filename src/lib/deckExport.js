import { withDbConnection } from "../db/transactions";
import { BACKUP_APP, BACKUP_VERSION } from "./backup";
import { newCardState } from "./scheduler";

// Un mazo compartido es contenido, con identidades nuevas al importarlo.
// Leer solo sus filas evita incluir datos privados de otros mazos o chats.
export async function buildDeckExport(db, deckId, now = new Date()) {
  return withDbConnection(db, async (tx) => {
    const deck = await tx.getFirstAsync("SELECT * FROM decks WHERE id = ?", [deckId]);
    if (!deck) throw new Error("El mazo ya no existe.");
    const cards = await tx.getAllAsync("SELECT * FROM cards WHERE deck_id = ? ORDER BY position, id", [deckId]);
    if (!cards.length) throw new Error("Agregá al menos una tarjeta antes de compartir el mazo.");
    const tags = await tx.getAllAsync("SELECT t.id, t.name FROM tags t JOIN deck_tags dt ON dt.tag_id = t.id WHERE dt.deck_id = ?", [deckId]);
    return {
      app: BACKUP_APP, version: BACKUP_VERSION, kind: "deck", exportedAt: now.toISOString(),
      folders: [],
      decks: [{ id: 1, name: deck.name, icon: deck.icon, priority: 100, folder_id: null, created_at: now.toISOString() }],
      cards: cards.map((card, index) => ({
        id: index + 1, deck_id: 1, front: card.front, back: card.back, source: "manual",
        origin_card_id: null, created_at: now.toISOString(), ...newCardState(now),
        starred: 0, suspended: 0, position: index + 1,
      })),
      tags: tags.map((tag, index) => ({ id: index + 1, name: tag.name })),
      deck_tags: tags.map((_, index) => ({ deck_id: 1, tag_id: index + 1 })),
      review_logs: [], connections: [], gym_chats: [], gym_messages: [],
    };
  });
}
