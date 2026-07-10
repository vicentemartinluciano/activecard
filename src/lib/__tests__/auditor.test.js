import { validateAuditorResult } from "../auditor";

describe("validateAuditorResult", () => {
  test("crítica válida: sin tarjeta híbrida", () => {
    const r = validateAuditorResult({
      veredicto: "critica",
      feedback: "La conexión es vaga. ¿Qué mecanismo concreto comparten?",
      hybrid_card: null,
    });
    expect(r.validated).toBe(false);
    expect(r.hybrid).toBeNull();
    expect(r.feedback).toContain("vaga");
  });

  test("validación con tarjeta híbrida completa", () => {
    const r = validateAuditorResult({
      veredicto: "valida",
      feedback: "Sólida: identificaste el mecanismo común.",
      hybrid_card: { front: "¿Qué une a la entropía con tu club?", back: "Ambos decaen sin energía externa." },
    });
    expect(r.validated).toBe(true);
    expect(r.hybrid.front).toContain("entropía");
  });

  test("valida sin tarjeta → error recuperable", () => {
    expect(() =>
      validateAuditorResult({ veredicto: "valida", feedback: "Bien.", hybrid_card: null })
    ).toThrow(/no generó la tarjeta/);
  });

  test("veredicto desconocido → error", () => {
    expect(() =>
      validateAuditorResult({ veredicto: "quizás", feedback: "..." })
    ).toThrow(/veredicto/);
  });

  test("sin feedback → error", () => {
    expect(() => validateAuditorResult({ veredicto: "critica" })).toThrow(/feedback/);
  });

  test("tarjeta híbrida con campos vacíos no cuenta como tarjeta", () => {
    expect(() =>
      validateAuditorResult({
        veredicto: "valida",
        feedback: "Bien.",
        hybrid_card: { front: "  ", back: "" },
      })
    ).toThrow(/no generó la tarjeta/);
  });
});
