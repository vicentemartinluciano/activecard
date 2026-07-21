import { buildAuditorMessages, validateAuditorTurn } from "../auditor";
import { AUDITOR_SYNTH_REQUEST } from "../prompts";

describe("validateAuditorTurn", () => {
  test("charla válida: sin tarjeta", () => {
    const r = validateAuditorTurn({
      modo: "charla",
      mensaje: "La conexión es vaga. ¿Qué mecanismo concreto comparten?",
      tarjeta: null,
    });
    expect(r.mode).toBe("charla");
    expect(r.card).toBeNull();
    expect(r.message).toContain("vaga");
  });

  test("charla con tarjeta presente: la ignora (card null)", () => {
    const r = validateAuditorTurn({
      modo: "charla",
      mensaje: "Seguimos.",
      tarjeta: { front: "algo", back: "algo" },
    });
    expect(r.mode).toBe("charla");
    expect(r.card).toBeNull();
  });

  test("síntesis con tarjeta completa (trimmeada)", () => {
    const r = validateAuditorTurn({
      modo: "sintesis",
      mensaje: "Ya está madura: identificaste el mecanismo común.",
      tarjeta: { front: "  ¿Qué une a la entropía con tu club?  ", back: "  Ambos decaen sin energía externa.  " },
    });
    expect(r.mode).toBe("sintesis");
    expect(r.card.front).toBe("¿Qué une a la entropía con tu club?");
    expect(r.card.back).toBe("Ambos decaen sin energía externa.");
  });

  test("síntesis sin tarjeta → error recuperable", () => {
    expect(() =>
      validateAuditorTurn({ modo: "sintesis", mensaje: "Listo.", tarjeta: null })
    ).toThrow(/no armó la tarjeta/);
  });

  test("síntesis con campos vacíos → error recuperable", () => {
    expect(() =>
      validateAuditorTurn({
        modo: "sintesis",
        mensaje: "Listo.",
        tarjeta: { front: "  ", back: "" },
      })
    ).toThrow(/no armó la tarjeta/);
  });

  test("modo desconocido (veredicto viejo) → error", () => {
    expect(() =>
      validateAuditorTurn({ veredicto: "valida", mensaje: "..." })
    ).toThrow(/modo/);
  });

  test("sin mensaje → error", () => {
    expect(() => validateAuditorTurn({ modo: "charla" })).toThrow(/mensaje/);
  });

  test("mensaje vacío → error", () => {
    expect(() => validateAuditorTurn({ modo: "charla", mensaje: "   " })).toThrow(/mensaje/);
  });
});

describe("buildAuditorMessages", () => {
  const card = { front: "¿Qué es la entropía?", back: "Medida de desorden." };

  test("primer mensaje = contexto con frente y dorso de la tarjeta origen", () => {
    const msgs = buildAuditorMessages(card, []);
    expect(msgs[0].role).toBe("user");
    expect(msgs[0].content).toContain("¿Qué es la entropía?");
    expect(msgs[0].content).toContain("Medida de desorden.");
  });

  test("mapeo de roles: auditor→assistant, user→user", () => {
    const msgs = buildAuditorMessages(card, [
      { role: "user", text: "Se conecta con mi club." },
      { role: "auditor", text: "¿Cómo, concretamente?" },
    ]);
    expect(msgs[1]).toEqual({ role: "user", content: "Se conecta con mi club." });
    expect(msgs[2]).toEqual({ role: "assistant", content: "¿Cómo, concretamente?" });
  });

  test("turno auditor con tarjeta re-inyecta la propuesta en el contenido", () => {
    const msgs = buildAuditorMessages(card, [
      { role: "auditor", text: "Cerremos así.", card: { front: "Pregunta X", back: "Respuesta Y" } },
    ]);
    expect(msgs[1].content).toContain("[TARJETA PROPUESTA]");
    expect(msgs[1].content).toContain("Pregunta X");
    expect(msgs[1].content).toContain("Respuesta Y");
  });

  test("forceSynthesis agrega el pedido de síntesis como último mensaje user", () => {
    const msgs = buildAuditorMessages(card, [{ role: "user", text: "hola" }], {
      forceSynthesis: true,
    });
    const last = msgs[msgs.length - 1];
    expect(last).toEqual({ role: "user", content: AUDITOR_SYNTH_REQUEST });
  });

  test("sin forceSynthesis no aparece el pedido de síntesis", () => {
    const msgs = buildAuditorMessages(card, [{ role: "user", text: "hola" }]);
    expect(msgs.some((m) => m.content === AUDITOR_SYNTH_REQUEST)).toBe(false);
  });
});
