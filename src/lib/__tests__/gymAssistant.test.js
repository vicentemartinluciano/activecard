import { validateGymTurn } from "../gymAssistant";
import { decodeToggle, toPlainText } from "../richtext";

test("acepta conversación normal sin acción", () => {
  expect(validateGymTurn({ message: "Podemos mirar ese tema desde otro ángulo.", action: null })).toEqual({
    message: "Podemos mirar ese tema desde otro ángulo.",
    action: null,
  });
});

test("acepta una propuesta pero no la ejecuta", () => {
  const result = validateGymTurn({
    message: "Preparé el cambio.",
    action: { type: "edit_card", cardId: 4, front: "F", back: "B" },
  });
  expect(result.action.type).toBe("edit_card");
  expect(result.action.cardId).toBe(4);
});

test("rechaza acciones desconocidas", () => {
  expect(() => validateGymTurn({ message: "Listo", action: { type: "drop_database" } })).toThrow(/inválida/);
});

test("rechaza choose_card generado por la IA", () => {
  expect(() => validateGymTurn({ message: "Elegí", action: { type: "choose_card", options: [] } })).toThrow(/inválida/);
});

test("rechaza propuestas de edición incompletas", () => {
  expect(() =>
    validateGymTurn({ message: "Preparé el cambio.", action: { type: "edit_card", cardId: 4 } })
  ).toThrow(/frente y dorso/);
});

test("normaliza ids numéricos antes de mostrar una propuesta", () => {
  const result = validateGymTurn({
    message: "Preparé una tarjeta.",
    action: { type: "create_card", deckId: "7", front: "F", back: "B" },
  });
  expect(result.action.deckId).toBe(7);
});

test("rechaza respuestas sin mensaje visible", () => {
  expect(() => validateGymTurn({ action: null })).toThrow(/mensaje/);
});

test("acepta crear un mazo con una propuesta múltiple", () => {
  const result = validateGymTurn({
    message: "Este tema merece un mazo separado.",
    action: {
      type: "create_deck",
      name: "Ofertas de valor",
      folderId: "3",
      cards: [
        { front: "¿Qué aumenta el valor?", back: "El resultado soñado." },
        { front: "¿Qué reduce el valor?", back: "El esfuerzo y el tiempo." },
      ],
    },
  });
  expect(result.action.folderId).toBe(3);
  expect(result.action.cards).toHaveLength(2);
});

test("rechaza una eliminación de carpeta con IDs inválidos", () => {
  expect(() => validateGymTurn({
    message: "Preparé la eliminación.",
    action: { type: "delete_folder", folderId: 3, deleteDeckIds: [4, "x"] },
  })).toThrow(/selección de mazos/);
});

test("acepta y compila bloques ricos en edit_card y create_card", () => {
  const blocks = [
    { type: "paragraph", text: "**Idea central** → resumen breve" },
    { type: "toggle", title: "**Ejemplo concreto**", blocks: [{ type: "paragraph", text: "Detalle desplegable" }] },
  ];
  const edited = validateGymTurn({
    message: "Sumé un desplegable.",
    action: { type: "edit_card", cardId: 4, front: "Pregunta", back: blocks },
  });
  expect(typeof edited.action.back).toBe("string");
  const lines = edited.action.back.split("\n");
  expect(decodeToggle(lines[1])).toEqual({
    summary: "**Ejemplo concreto**",
    content: "Detalle desplegable",
  });
  expect(toPlainText(edited.action.back)).toContain("Ejemplo concreto");

  const batch = validateGymTurn({
    message: "Preparé tarjetas.",
    action: {
      type: "create_cards",
      deckId: 2,
      cards: [{ front: "¿Qué es?", back: [{ type: "paragraph", text: "Respuesta" }] }],
    },
  });
  expect(batch.action.cards[0].back).toBe("Respuesta");
});
