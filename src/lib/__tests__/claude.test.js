import { extractJson } from "../claude";

describe("extractJson (parseo robusto de respuestas de IA)", () => {
  test("JSON directo", () => {
    expect(extractJson('{"cards": []}')).toEqual({ cards: [] });
  });

  test("JSON dentro de un bloque ```json```", () => {
    const text = 'Acá van las tarjetas:\n```json\n{"cards": [{"front": "a", "back": "b"}]}\n```';
    expect(extractJson(text).cards).toHaveLength(1);
  });

  test("JSON con prosa alrededor", () => {
    const text = 'Claro, este es el resultado: {"cards": [{"front": "x", "back": "y"}]} ¡Éxito!';
    expect(extractJson(text).cards[0].front).toBe("x");
  });

  test("llaves dentro de strings no rompen el balanceo", () => {
    const text = '{"cards": [{"front": "¿Qué es {esto}?", "back": "una } llave \\" escapada"}]}';
    expect(extractJson(text).cards[0].front).toContain("{esto}");
  });

  test("sin JSON lanza error claro", () => {
    expect(() => extractJson("No pude procesar el material.")).toThrow(/no contiene JSON/);
  });

  test("JSON cortado lanza error", () => {
    expect(() => extractJson('{"cards": [{"front": "a"')).toThrow(/incompleto/);
  });

  test("respuesta vacía lanza error", () => {
    expect(() => extractJson("")).toThrow(/vacía/);
  });
});
