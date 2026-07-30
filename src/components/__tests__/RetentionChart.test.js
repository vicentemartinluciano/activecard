import { smoothPath } from "../RetentionChart";

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
