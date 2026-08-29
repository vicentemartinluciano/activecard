import { getCard } from "../../db/cards";
import { listDecks } from "../../db/decks";
import { callOpenAIJson } from "../openai";
import { runGymAssistant } from "../gymAssistant";

jest.mock("../../db/cards", () => ({
  getCard: jest.fn(),
  listAllCardsForSearch: jest.fn(),
}));
jest.mock("../../db/decks", () => ({ listDecks: jest.fn() }));
jest.mock("../openai", () => ({ callOpenAIJson: jest.fn(), REASONING: { chat: "high" } }));

beforeEach(() => {
  jest.clearAllMocks();
  listDecks.mockResolvedValue([{ id: 2, name: "Administración" }]);
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
