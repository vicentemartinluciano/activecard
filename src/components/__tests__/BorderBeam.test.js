import { roundedRectPath } from "../BorderBeam";

test("dibuja un único contorno cerrado con cuatro esquinas redondeadas", () => {
  const path = roundedRectPath(340, 180, 20, 3);

  expect(path).toMatch(/^M /);
  expect(path.match(/Q/g)).toHaveLength(4);
  expect(path).toMatch(/ Z$/);
  expect(path).toContain("H 320");
  expect(path).toContain("V 160");
});
