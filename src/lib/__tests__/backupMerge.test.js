import { buildBackup } from "../backup";
import { applyAdditiveImport, buildAdditiveImportPlan } from "../backupMerge";

const TABLES = [
  "folders", "decks", "tags", "deck_tags", "cards", "review_logs", "connections",
  "gym_chats", "gym_messages",
];

function completeBackup(data = {}) {
  return {
    app: "activecard",
    version: 3,
    exportedAt: "2026-08-30T12:00:00.000Z",
    ...Object.fromEntries(TABLES.map((table) => [table, []])),
    ...data,
  };
}

function fakeDb(initial = {}) {
  const tables = Object.fromEntries(TABLES.map((table) => [table, [...(initial[table] || [])]]));
  const log = [];
  const ids = Object.fromEntries(TABLES.map((table) => [
    table,
    Math.max(0, ...tables[table].map((row) => Number(row.id) || 0)),
  ]));
  return {
    tables,
    log,
    async getAllAsync(sql) {
      const table = /FROM (\w+)/.exec(sql)[1];
      return tables[table].map((row) => ({ ...row }));
    },
    async execAsync(sql) {
      log.push(sql);
    },
    async runAsync(sql, params) {
      const insert = /INSERT INTO (\w+) \(([^)]+)\)/.exec(sql);
      if (insert) {
        const [, table, columnsText] = insert;
        const columns = columnsText.split(",").map((column) => column.trim());
        const row = {};
        columns.forEach((column, index) => { row[column] = params[index]; });
        if (!Object.hasOwn(row, "id") && !["deck_tags"].includes(table)) row.id = ++ids[table];
        tables[table].push(row);
        return { lastInsertRowId: row.id };
      }
      const update = /UPDATE cards SET origin_card_id = \? WHERE id = \?/.exec(sql);
      if (update) {
        const row = tables.cards.find((card) => Number(card.id) === Number(params[1]));
        if (row) row.origin_card_id = params[0];
        return { changes: row ? 1 : 0 };
      }
      throw new Error(`SQL no soportado por el test: ${sql}`);
    },
  };
}

const current = completeBackup({
  folders: [{ id: 1, name: "Marketing", created_at: "a" }],
  decks: [{ id: 1, name: "Ofertas", created_at: "a", folder_id: 1 }],
  cards: [{ id: 1, deck_id: 1, front: "Duplicada", back: "Igual", created_at: "a", due: "a" }],
  gym_chats: [{ id: 1, title: "Charla existente", created_at: "a", updated_at: "a" }],
  gym_messages: [{ id: 1, chat_id: 1, role: "user", text: "Mismo texto", created_at: "a" }],
});

const incoming = completeBackup({
  folders: [{ id: 10, name: "Marketing", created_at: "b" }],
  decks: [{ id: 20, name: "Ofertas", created_at: "b", folder_id: 10, priority: 75 }],
  tags: [{ id: 25, name: "ventas" }],
  deck_tags: [{ deck_id: 20, tag_id: 25 }],
  cards: [
    { id: 30, deck_id: 20, front: "Duplicada", back: "Igual", created_at: "b", due: "b" },
    { id: 31, deck_id: 20, front: "Nueva", back: "Contenido", created_at: "b", due: "2030-01-01", stability: 9 },
  ],
  review_logs: [{ id: 35, card_id: 31, rating: "good", mode: "deck", reviewed_at: "b" }],
  connections: [{ id: 36, card_id: 31, final_text: "Idea", transcript: "[]", hybrid_card_id: null, created_at: "b" }],
  gym_chats: [
    { id: 40, title: "Charla nueva", origin_card_id: 31, created_at: "b", updated_at: "b" },
    { id: 41, title: "Charla existente", created_at: "b", updated_at: "b" },
  ],
  gym_messages: [
    { id: 50, chat_id: 40, role: "user", text: "Creá algo", metadata: JSON.stringify({ attachments: [{ cardId: 31, deckId: 20 }] }), created_at: "b" },
    { id: 51, chat_id: 41, role: "user", text: "Mismo texto", created_at: "b" },
  ],
});

describe("importación acumulativa", () => {
  test("propone solo lo nuevo y diferencia carpetas/mazos que chocan", () => {
    const plan = buildAdditiveImportPlan(current, incoming);
    expect(plan.counts).toEqual(expect.objectContaining({
      folders: 1,
      decks: 1,
      cards: 1,
      chats: 1,
      duplicateCards: 1,
      duplicateChats: 1,
    }));
    expect(plan.folders[0].importName).toBe("Marketing (importado)");
    expect(plan.folders[0].decks[0].importName).toBe("Ofertas (importado)");
    expect(plan.initialSelection).toEqual({ cardIds: [31], chatIds: [40] });
  });

  test("preserva progreso, remapea relaciones y la segunda importación no agrega nada", async () => {
    const db = fakeDb(current);
    const plan = buildAdditiveImportPlan(current, incoming);
    const counts = await applyAdditiveImport(db, incoming, plan.initialSelection, plan);

    expect(counts).toEqual(expect.objectContaining({
      folders: 1,
      decks: 1,
      cards: 1,
      review_logs: 1,
      connections: 1,
      gym_chats: 1,
      gym_messages: 1,
    }));
    expect(db.tables.folders.map((folder) => folder.name)).toContain("Marketing (importado)");
    expect(db.tables.decks.map((deck) => deck.name)).toContain("Ofertas (importado)");
    const newCard = db.tables.cards.find((card) => card.front === "Nueva");
    expect(newCard).toEqual(expect.objectContaining({ due: "2030-01-01", stability: 9 }));
    expect(db.tables.review_logs.find((log) => log.rating === "good").card_id).toBe(newCard.id);
    expect(db.tables.connections.find((connection) => connection.final_text === "Idea").card_id).toBe(newCard.id);
    const importedMessage = db.tables.gym_messages.find((message) => message.text === "Creá algo");
    expect(JSON.parse(importedMessage.metadata).attachments[0]).toEqual(expect.objectContaining({
      cardId: newCard.id,
      deckId: newCard.deck_id,
    }));
    expect(db.log).toEqual(["BEGIN", "COMMIT"]);

    const after = await buildBackup(db);
    const secondPlan = buildAdditiveImportPlan(after, incoming);
    expect(secondPlan.counts.cards).toBe(0);
    expect(secondPlan.counts.chats).toBe(0);
    expect(secondPlan.folders).toEqual([]);
  });

  test("no crea contenedores vacíos cuando el usuario descarta las tarjetas", async () => {
    const db = fakeDb(current);
    const plan = buildAdditiveImportPlan(current, incoming);
    const counts = await applyAdditiveImport(db, incoming, { cardIds: [], chatIds: [] }, plan);
    expect(counts).toEqual(expect.objectContaining({ folders: 0, decks: 0, cards: 0, gym_chats: 0 }));
    expect(db.tables.folders).toHaveLength(1);
    expect(db.tables.decks).toHaveLength(1);
  });

  test("también omite duplicados que ya vienen repetidos dentro del archivo", () => {
    const repeated = completeBackup({
      decks: [{ id: 1, name: "Mazo", created_at: "a" }],
      cards: [
        { id: 1, deck_id: 1, front: "Una", back: "Misma" },
        { id: 2, deck_id: 1, front: "Una", back: "Misma" },
      ],
      gym_chats: [
        { id: 1, title: "Igual", created_at: "a", updated_at: "a" },
        { id: 2, title: "Igual", created_at: "a", updated_at: "a" },
      ],
      gym_messages: [
        { id: 1, chat_id: 1, role: "user", text: "Hola" },
        { id: 2, chat_id: 2, role: "user", text: "Hola" },
      ],
    });
    const plan = buildAdditiveImportPlan(completeBackup(), repeated);
    expect(plan.counts).toEqual(expect.objectContaining({
      cards: 1,
      duplicateCards: 1,
      chats: 1,
      duplicateChats: 1,
    }));
  });
});
