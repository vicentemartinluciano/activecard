import { callOpenAI, callOpenAIJson, extractJson } from "../openai";

jest.mock("../keys", () => ({ getOpenAIKey: () => "test-key" }));

describe("contrato de la solicitud Responses API", () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    global.fetch = jest.fn(async (_url, options) => {
      const body = JSON.parse(options.body);
      const hasJsonInstruction = body.input.some((message) =>
        message.role === "developer" && /JSON/i.test(message.content)
      );
      if (body.text.format.type === "json_object" && !hasJsonInstruction) {
        return {
          ok: false,
          status: 400,
          json: async () => ({ error: { message: "Response input messages must contain the word 'json'." } }),
        };
      }
      return {
        ok: true,
        json: async () => ({ status: "completed", output_text: '{"message":"Respuesta","action":null}' }),
      };
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test("el primer turno común incluye la instrucción JSON en input", async () => {
    const messages = [{ role: "user", content: "¿Qué dice la teoría de juegos?" }];
    await expect(callOpenAIJson({ system: "Respondé en JSON con message y action.", messages }))
      .resolves.toEqual({ message: "Respuesta", action: null });

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.instructions).toBe("Respondé en JSON con message y action.");
    expect(body.input.slice(1)).toEqual(messages);
    expect(messages).toHaveLength(1);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test("conserva historial y adjuntos multimodales al pedir JSON", async () => {
    const messages = [
      { role: "user", content: "Explicame este documento" },
      { role: "assistant", content: "¿Qué parte querés trabajar?" },
      { role: "user", content: [
        { type: "input_text", text: "Este ejemplo" },
        { type: "input_file", filename: "ejemplo.pdf", file_data: "data:application/pdf;base64,test" },
      ] },
    ];
    await callOpenAIJson({ system: "Usá el formato solicitado.", messages });
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.input.slice(1)).toEqual(messages);
    expect(body.text.format).toEqual({ type: "json_object" });
  });

  test("las respuestas de texto mantienen su input original", async () => {
    const messages = [{ role: "user", content: "Hola" }];
    await callOpenAI({ system: "Conversá normalmente.", messages });
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.input).toEqual(messages);
    expect(body.text.format).toEqual({ type: "text" });
  });
});

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
