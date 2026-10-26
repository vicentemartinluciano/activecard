import {
  clearDraft,
  getDraft,
  loadDraft,
  persistDraft,
  setDraft,
} from "../draftStore";

const mockStore = {};

jest.mock("../../db/settings", () => ({
  getSetting: jest.fn(async (key, fallback) =>
    Object.prototype.hasOwnProperty.call(mockStore, key) ? mockStore[key] : fallback
  ),
  setSetting: jest.fn(async (key, value) => {
    mockStore[key] = value;
  }),
}));

beforeEach(async () => {
  for (const key of Object.keys(mockStore)) delete mockStore[key];
  await clearDraft();
});

test("persiste y normaliza una generación nueva", async () => {
  const draft = await setDraft([{ front: "F", back: "D" }], "texto");

  expect(getDraft()).toEqual(draft);
  expect(draft.cards[0]).toMatchObject({
    front: "F",
    back: "D",
    kept: true,
    manual: false,
    savedCardId: null,
  });
  expect(mockStore.generationDraft).toEqual(draft);
});

test("recupera el borrador después de limpiar la copia en memoria", async () => {
  await clearDraft();
  mockStore.generationDraft = {
    sourceLabel: "Notion",
    deckId: 8,
    cards: [{ front: "F", back: "D", kept: false }],
  };

  const recovered = await loadDraft();

  expect(recovered.deckId).toBe(8);
  expect(recovered.cards[0]).toMatchObject({ kept: false, savedCardId: null });
});

test("conserva qué tarjetas ya se guardaron y luego elimina el borrador", async () => {
  await persistDraft({
    sourceLabel: "PDF",
    deckId: 3,
    cards: [{ front: "F", back: "D", savedCardId: 44 }],
  });

  expect(getDraft().cards[0].savedCardId).toBe(44);
  await clearDraft();
  expect(getDraft()).toBeNull();
  expect(mockStore.generationDraft).toBeNull();
});

test('conserva carpeta, nombre y selección de nuevo mazo al persistir y recuperar', async () => {
  await setDraft([{ front: 'F', back: 'D' }], 'Archivo', { folderId: 8, createNewDeck: true });
  await persistDraft({ ...getDraft(), newDeckName: 'Unidad 2' });
  const stored = structuredClone(mockStore.generationDraft);
  await clearDraft();
  mockStore.generationDraft = stored;
  expect(await loadDraft()).toMatchObject({ version: 2, folderId: 8, createNewDeck: true, newDeckName: 'Unidad 2' });
});

test('borradores anteriores conservan destino existente sin forzar un mazo nuevo', async () => {
  mockStore.generationDraft = { sourceLabel: 'Anterior', deckId: 3, cards: [] };
  expect(await loadDraft()).toMatchObject({ deckId: 3, folderId: null, createNewDeck: false, newDeckName: '' });
});
