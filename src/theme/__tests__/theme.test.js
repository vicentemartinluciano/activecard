import { colors, gradients, radius, spacing, textColors, type } from "../index";

describe("tokens de tema", () => {
  test("los colores son hex válidos (6 dígitos, alpha opcional)", () => {
    for (const value of Object.values(colors)) {
      expect(value).toMatch(/^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/);
    }
  });

  test("el fondo es el obsidiana profundo del rediseño Obsidian Cobalt", () => {
    expect(colors.bg).toBe("#09090B");
  });

  test("el acento es el azul profundo elegido por el usuario", () => {
    expect(colors.accent).toBe("#3E63DD");
  });

  test("existen los tokens nuevos de la paleta flexible", () => {
    for (const token of ["surfaceCard", "accentText", "streak", "streakSoft", "highlight"]) {
      expect(colors[token]).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  test("existen los tokens del rediseño Quizlet (progreso verde y píldoras)", () => {
    expect(colors.successBright).toMatch(/^#[0-9A-Fa-f]{6}$/);
    // Las píldoras usan blanco semi-transparente (#RRGGBBAA).
    expect(colors.pillBg).toMatch(/^#[0-9A-Fa-f]{8}$/);
    expect(colors.pillBorder).toMatch(/^#[0-9A-Fa-f]{8}$/);
    expect(radius.pill).toBeGreaterThan(radius.lg);
    expect(type.heading).toBeDefined();
    expect(type.label).toBeDefined();
  });

  test("la paleta de colores de texto tiene 6 colores hex válidos", () => {
    expect(Object.keys(textColors)).toEqual([
      "rojo",
      "naranja",
      "amarillo",
      "verde",
      "azul",
      "violeta",
    ]);
    for (const value of Object.values(textColors)) {
      expect(value).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  test("espaciados y radios son números positivos", () => {
    for (const value of [...Object.values(spacing), ...Object.values(radius)]) {
      expect(value).toBeGreaterThan(0);
    }
  });

  test("los radios de contenedores quedan en el rango 16-20 del rediseño", () => {
    expect(radius.md).toBeGreaterThanOrEqual(16);
    expect(radius.lg).toBeLessThanOrEqual(20);
  });

  test("los degradados Obsidian Cobalt tienen los stops esperados", () => {
    expect(gradients.bar).toHaveLength(2);
    expect(gradients.hero).toHaveLength(3);
    for (const stops of Object.values(gradients)) {
      for (const value of stops) {
        expect(value).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    }
  });
});
