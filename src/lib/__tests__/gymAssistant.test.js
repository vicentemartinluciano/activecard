import { validateGymTurn } from "../gymAssistant";

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
