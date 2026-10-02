import { retentionScale, smoothPath } from "../RetentionChart";

test("construye una curva SVG continua entre todos los puntos", () => {
  const path = smoothPath([
    { x: 7, y: 70 },
    { x: 80, y: 30 },
    { x: 153, y: 45 },
  ]);

  expect(path).toMatch(/^M 7 70/);
  expect(path.match(/ C /g)).toHaveLength(2);
  expect(path).toMatch(/153 45$/);
});

test("tolera una serie vacía o de un solo punto", () => {
  expect(smoothPath([])).toBe("");
  expect(smoothPath([{ x: 7, y: 20 }])).toBe("M 7 20");
});

test("abre la escala para distinguir los porcentajes menores a 50", () => {
  const { ticks, yOf } = retentionScale([
    { pct: null },
    { pct: 0 },
    { pct: 30 },
    { pct: 100 },
  ]);
  expect(ticks).toEqual([100, 50, 0]);
  expect(yOf(0)).toBeGreaterThan(yOf(30));
  expect(yOf(30)).toBeGreaterThan(yOf(50));
  expect(yOf(100)).toBeGreaterThan(7); // El punto completo entra en el SVG.
  expect(yOf(0)).toBeLessThan(144 - 7);
});

test("mantiene el detalle de 50–100 cuando todos los valores entran", () => {
  expect(
    retentionScale([{ pct: null }, { pct: 50 }, { pct: 90 }]).ticks,
  ).toEqual([100, 75, 50]);
  expect(retentionScale([]).ticks).toEqual([100, 75, 50]);
});

test("el suavizado no inventa una caída entre dos semanas iguales", () => {
  const path = smoothPath([
    { x: 10, y: 120 },
    { x: 50, y: 20 },
    { x: 90, y: 20 },
  ]);
  const lastSegment = path.split(" C ").at(-1);
  const coordinates = lastSegment.match(/-?\d+(?:\.\d+)?/g).map(Number);
  expect([coordinates[1], coordinates[3], coordinates[5]]).toEqual([
    20, 20, 20,
  ]);
});
