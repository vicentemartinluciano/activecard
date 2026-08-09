const rows = [];
const calls = [];

const db = {
  async runAsync(sql, params) {
    calls.push({ sql, params });
    return { lastInsertRowId: 17 };
  },
  async getAllAsync(sql, params) {
    calls.push({ sql, params });
    return rows;
  },
};

jest.mock("../client", () => ({ getDb: jest.fn() }));

// eslint-disable-next-line import/first
import { getDb } from "../client";
// eslint-disable-next-line import/first
import { addGymMessage, createGymChat, listGymMessages, setGymChatDraft } from "../gymChats";

getDb.mockResolvedValue(db);

beforeEach(() => {
  rows.length = 0;
  calls.length = 0;
});

test("crea una charla libre o vinculada a una tarjeta", async () => {
  expect(await createGymChat({ originCardId: 8 })).toBe(17);
  expect(calls[0].params[1]).toBe(8);
  expect(calls[0].sql).toContain("INSERT INTO gym_chats");
});

test("guarda el mensaje antes de actualizar la fecha de la charla", async () => {
  expect(await addGymMessage(3, "user", "No quiero perder esto", { source: "voice" })).toBe(17);
  expect(calls[0].sql).toContain("INSERT INTO gym_messages");
  expect(calls[0].params[3]).toBe(JSON.stringify({ source: "voice" }));
  expect(calls[1].sql).toContain("UPDATE gym_chats SET updated_at");
});

test("restaura metadata válida y tolera metadata vieja inválida", async () => {
  rows.push(
    { id: 1, metadata: JSON.stringify({ action: { type: "edit_card" } }) },
    { id: 2, metadata: "no-json" }
  );
  const messages = await listGymMessages(3);
  expect(messages[0].metadata.action.type).toBe("edit_card");
  expect(messages[1].metadata).toBeNull();
});

test("persiste el borrador en la misma charla", async () => {
  await setGymChatDraft(3, "texto todavía no enviado");
  expect(calls[0].params[0]).toBe("texto todavía no enviado");
  expect(calls[0].params[2]).toBe(3);
});
