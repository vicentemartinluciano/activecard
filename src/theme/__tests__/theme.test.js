import { colors, radius, spacing } from "../index";

describe("tokens de tema", () => {
  test("los colores son hex válidos", () => {
    for (const value of Object.values(colors)) {
      expect(value).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  test("el fondo es el oscuro profundo definido en el plan", () => {
    expect(colors.bg).toBe("#0B0B0F");
  });

  test("espaciados y radios son números positivos", () => {
    for (const value of [...Object.values(spacing), ...Object.values(radius)]) {
      expect(value).toBeGreaterThan(0);
    }
  });
});
