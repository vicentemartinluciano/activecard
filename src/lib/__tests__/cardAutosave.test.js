import { createCardAutosave } from "../cardAutosave";
import { createCard, getCard, updateCardText } from "../../db/cards";
import { setSetting } from "../../db/settings";
import { encodeToggle, IMG_SENTINEL } from "../richtext";
jest.mock("../../db/cards", () => ({ createCard: jest.fn(), getCard: jest.fn(), updateCardText: jest.fn() }));
jest.mock("../../db/settings", () => ({ getSetting: jest.fn(), setSetting: jest.fn() }));
beforeEach(() => { jest.useFakeTimers(); jest.clearAllMocks(); setSetting.mockResolvedValue(); updateCardText.mockResolvedValue(); });
afterEach(() => jest.useRealTimers());

test("un borrador incompleto queda local y no crea tarjetas vacías para estudiar", async () => {
  const saver = createCardAutosave({ deckId: 7 });
  saver.change({ front: "A medio escribir", back: "" });
  expect(await saver.flush()).toBe(true);
  expect(createCard).not.toHaveBeenCalled();
  expect(setSetting).toHaveBeenCalledWith("cardDraft:7:new", expect.objectContaining({ front: "A medio escribir", back: "" }));
  expect(saver.isPending()).toBe(false);
});

test("autoguarda una imagen dentro del desplegable y conserva vacío como borrador", async () => {
  createCard.mockResolvedValue(12);
  const saver = createCardAutosave({ deckId: 7 });
  saver.change({ front: "Pregunta", back: encodeToggle("", "") });
  await saver.flush();
  expect(createCard).not.toHaveBeenCalled();
  const back = encodeToggle("", encodeToggle("", IMG_SENTINEL + "100 data:image/png;base64,AA=="));
  saver.change({ front: "Pregunta", back });
  await saver.flush();
  expect(createCard).toHaveBeenCalledWith(expect.objectContaining({ front: "Pregunta", back }));
});

test("escribir durante la creación reutiliza la identidad y guarda también el texto más nuevo", async () => {
  let finish;
  createCard.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  getCard.mockResolvedValue({ id: 9, front: "Uno", back: "A" });
  const saved = jest.fn();
  const saver = createCardAutosave({ deckId: 7, onSaved: saved });
  saver.change({ front: "Uno", back: "A" });
  const first = saver.flush();
  await Promise.resolve(); await Promise.resolve();
  saver.change({ front: "Uno más nuevo", back: "A" });
  const second = saver.flush();
  finish(9);
  expect(await first).toBe(true); expect(await second).toBe(true);
  expect(createCard).toHaveBeenCalledTimes(1);
  expect(updateCardText).toHaveBeenCalledWith(9, "Uno más nuevo", "A", expect.objectContaining({ expected: { front: "Uno", back: "A" } }));
  expect(saved.mock.calls.at(-1)[0].front).toBe("Uno más nuevo");
});

test("un conflicto conserva el borrador local y frena la navegación", async () => {
  updateCardText.mockRejectedValue(new Error("Cambió en otro dispositivo"));
  const status = jest.fn();
  const saver = createCardAutosave({ deckId: 7, card: { id: 9, front: "Uno", back: "A" }, onStatus: status });
  saver.change({ front: "Mi versión", back: "A" });
  expect(await saver.flush()).toBe(false);
  expect(setSetting).not.toHaveBeenCalledWith("cardDraft:7:9", null);
  expect(status).toHaveBeenLastCalledWith("error", "Cambió en otro dispositivo");
});

test("recuperar un borrador que ya tiene identidad actualiza esa tarjeta sin otro INSERT", async () => {
  getCard.mockResolvedValue({ id: 9, deck_id: 7, source: "manual", front: "Uno", back: "A" });
  const restored = { cardId: 9, keyId: null, expected: { front: "Uno", back: "A" }, front: "Versión recuperada", back: "A" };
  const saver = createCardAutosave({ deckId: 7, restored });
  saver.change(restored);
  expect(await saver.flush()).toBe(true);
  expect(createCard).not.toHaveBeenCalled();
  expect(updateCardText).toHaveBeenCalledWith(9, "Versión recuperada", "A", expect.objectContaining({ expected: restored.expected }));
});

test("recuperar una identidad eliminada conserva el borrador y no resucita la tarjeta", async () => {
  getCard.mockResolvedValue(null);
  const restored = { cardId: 9, front: "Borrador recuperado", back: "A" };
  const saver = createCardAutosave({ deckId: 7, restored });
  saver.change(restored);
  expect(await saver.flush()).toBe(false);
  expect(createCard).not.toHaveBeenCalled();
});
