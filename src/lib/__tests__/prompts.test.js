import { buildGeneratorMessage, buildGeneratorPdfPrompt } from "../prompts";

describe("buildGeneratorMessage", () => {
  test("sin instrucción personalizada no incluye el bloque adicional", () => {
    const msg = buildGeneratorMessage({ text: "material de prueba", mode: "conceptos_clave" });
    expect(msg).not.toContain("INSTRUCCIONES ADICIONALES DEL USUARIO");
    expect(msg).toContain("Modo: conceptos_clave");
    expect(msg).toContain("material de prueba");
  });

  test("con instrucción personalizada incluye el bloque y conserva el material", () => {
    const msg = buildGeneratorMessage({
      text: "material de prueba",
      mode: "personalizado",
      custom: "extraé solo fechas y nombres propios",
    });
    expect(msg).toContain("Modo: personalizado");
    expect(msg).toContain("INSTRUCCIONES ADICIONALES DEL USUARIO");
    expect(msg).toContain("extraé solo fechas y nombres propios");
    expect(msg).toContain("material de prueba");
  });

  test("instrucción personalizada vacía o solo espacios no agrega el bloque", () => {
    const msg = buildGeneratorMessage({ text: "material", mode: "personalizado", custom: "   " });
    expect(msg).not.toContain("INSTRUCCIONES ADICIONALES DEL USUARIO");
  });
});

describe("buildGeneratorPdfPrompt", () => {
  test("sin custom no incluye el bloque adicional", () => {
    const msg = buildGeneratorPdfPrompt("completo");
    expect(msg).not.toContain("INSTRUCCIONES ADICIONALES DEL USUARIO");
    expect(msg).toContain("Modo: completo");
  });

  test("con custom incluye el bloque antes de la referencia al PDF adjunto", () => {
    const msg = buildGeneratorPdfPrompt("personalizado", "solo definiciones con nombre de autor");
    expect(msg).toContain("Modo: personalizado");
    expect(msg).toContain("INSTRUCCIONES ADICIONALES DEL USUARIO");
    expect(msg).toContain("solo definiciones con nombre de autor");
    expect(msg).toContain("PDF adjunto");
  });
});
