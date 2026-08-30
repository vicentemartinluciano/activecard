import { getCard } from "../../db/cards";
import { listDecks } from "../../db/decks";
import { listFolders } from "../../db/folders";
import { callOpenAIJson } from "../openai";
import { runGymAssistant } from "../gymAssistant";

jest.mock("../../db/cards", () => ({
  getCard: jest.fn(),
  listAllCardsForSearch: jest.fn(),
}));
jest.mock("../../db/decks", () => ({ listDecks: jest.fn() }));
jest.mock("../../db/folders", () => ({ listFolders: jest.fn() }));
jest.mock("../openai", () => ({ callOpenAIJson: jest.fn(), REASONING: { chat: "high" } }));

beforeEach(() => {
  jest.clearAllMocks();
  listDecks.mockResolvedValue([{ id: 2, name: "Administración" }]);
  listFolders.mockResolvedValue([]);
  getCard.mockImplementation(async (id) => id === 9 ? {
    id: 9,
    deck_id: 2,
    front: "¿Qué es una ventaja competitiva?",
    back: "Es una posición difícil de imitar.",
  } : null);
});

test("incluye varias tarjetas adjuntas como contexto accionable", async () => {
  callOpenAIJson.mockResolvedValue({
    message: "Preparé el cambio.",
    action: { type: "edit_card", cardId: 9, front: "Frente final", back: "Dorso final" },
  });

  const result = await runGymAssistant({
    messages: [{
      role: "user",
      text: "Mejorá esta tarjeta",
      metadata: { attachments: [{ cardId: 9, deckName: "Administración", front: "Vista previa" }] },
    }],
  });

  expect(result.action.cardId).toBe(9);
  expect(callOpenAIJson.mock.calls[0][0].system).toContain("TARJETAS ADJUNTAS POR EL USUARIO");
  expect(callOpenAIJson.mock.calls[0][0].system).toContain("Es una posición difícil de imitar.");
});

test("rechaza una edición sobre una tarjeta que no fue adjuntada", async () => {
  callOpenAIJson.mockResolvedValue({
    message: "Preparé el cambio.",
    action: { type: "edit_card", cardId: 99, front: "F", back: "B" },
  });

  await expect(runGymAssistant({
    messages: [{ role: "user", text: "Editala", metadata: { attachments: [{ cardId: 9 }] } }],
  })).rejects.toThrow(/no estaba en el contexto/);
});

test("envía las fuentes adjuntas en el formato multimodal de Responses API", async () => {
  callOpenAIJson.mockResolvedValue({ message: "Leí las fuentes.", action: null });

  await runGymAssistant({
    messages: [{
      role: "user",
      text: "Compará estos materiales",
      metadata: {
        sources: [
          { kind: "text", name: "ideas.md", mimeType: "text/markdown", text: "Idea central" },
          { kind: "file", name: "apunte.pdf", mimeType: "application/pdf", base64: "UERG" },
          { kind: "file", name: "grafico.png", mimeType: "image/png", base64: "UE5H" },
        ],
      },
    }],
  });

  const input = callOpenAIJson.mock.calls[0][0].messages;
  const sourceTurn = input[input.length - 1];
  expect(sourceTurn.role).toBe("user");
  expect(sourceTurn.content).toEqual(expect.arrayContaining([
    expect.objectContaining({ type: "input_text", text: expect.stringContaining("Idea central") }),
    expect.objectContaining({ type: "input_file", filename: "apunte.pdf", file_data: "data:application/pdf;base64,UERG" }),
    expect.objectContaining({ type: "input_image", image_url: "data:image/png;base64,UE5H" }),
  ]));
});

test("acepta un mazo nuevo dentro de una carpeta real", async () => {
  listFolders.mockResolvedValue([{ id: 3, name: "Marketing" }]);
  callOpenAIJson.mockResolvedValue({
    message: "Conviene separarlo en un mazo propio.",
    action: {
      type: "create_deck",
      name: "Ofertas de valor",
      folderId: 3,
      cards: [{ front: "¿Qué aumenta el valor?", back: "El resultado soñado." }],
    },
  });

  const result = await runGymAssistant({
    messages: [{ role: "user", text: "Creame el mazo en Marketing" }],
  });

  expect(result.action.type).toBe("create_deck");
  expect(result.action.folderId).toBe(3);
  expect(callOpenAIJson.mock.calls[0][0].system).toContain("3: Marketing");
});

test("impide borrar desde una carpeta un mazo que no le pertenece", async () => {
  listFolders.mockResolvedValue([{ id: 3, name: "Marketing" }]);
  listDecks.mockResolvedValue([
    { id: 2, name: "Ofertas", folder_id: 3 },
    { id: 8, name: "Finanzas", folder_id: 4 },
  ]);
  callOpenAIJson.mockResolvedValue({
    message: "Preparé la eliminación.",
    action: { type: "delete_folder", folderId: 3, deleteDeckIds: [8] },
  });

  await expect(runGymAssistant({
    messages: [{ role: "user", text: "Borrá Marketing" }],
  })).rejects.toThrow(/mazo ajeno/);
});
