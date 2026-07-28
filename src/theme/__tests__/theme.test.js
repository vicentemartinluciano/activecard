import {
  colors,
  font,
  glow,
  gradients,
  HALO_PADDING,
  radius,
  spacing,
  textColors,
  type,
} from "../index";

describe("tokens de tema", () => {
  test("los colores son hex válidos (6 dígitos, alpha opcional) o rgba()", () => {
    for (const value of Object.values(colors)) {
      expect(value).toMatch(/^(#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?|rgba\(\d+,\d+,\d+,0?\.\d+\))$/);
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
    expect(gradients.card).toHaveLength(2);
    for (const stops of Object.values(gradients)) {
      for (const value of stops) {
        expect(value).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    }
  });

  test("los glows son boxShadow strings no vacíos", () => {
    for (const token of ["halo", "haloViolet", "green", "cyan"]) {
      expect(typeof glow[token].boxShadow).toBe("string");
      expect(glow[token].boxShadow.length).toBeGreaterThan(0);
    }
    // glow vive aparte: no debe colarse dentro de gradients (sus valores son arrays de hex).
    expect(gradients.glow).toBeUndefined();
  });

  test("el halo es cobalto (mismo tono que el acento), no cián", () => {
    expect(glow.halo.boxShadow).toContain("62,99,221");
    expect(glow.halo.boxShadow).not.toContain("0,242,254");
  });

  test("el blur del halo no supera el aire que le damos al contenedor", () => {
    // Si el blur fuera mayor que HALO_PADDING, Android lo recortaría contra el
    // borde del ScrollView y se vería cortado de golpe.
    const blurs = [...glow.halo.boxShadow.matchAll(/0 0 (\d+)px/g)].map((m) => Number(m[1]));
    expect(Math.max(...blurs)).toBeLessThanOrEqual(HALO_PADDING);
  });

  test("la tipografía mapea cada peso a una familia propia", () => {
    // RN no combina fontFamily + fontWeight: cada peso necesita su archivo.
    for (const weight of [400, 500, 600, 700, 800]) {
      expect(font(weight).fontFamily).toMatch(/^PlusJakartaSans_/);
    }
    expect(font(700).fontFamily).not.toBe(font(400).fontFamily);
    expect(type.title.fontFamily).toBeDefined();
  });
});
