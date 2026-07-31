import { Animated } from "react-native";

import { swipeOpacities } from "../SwipeCard";

const UMBRAL = 90;

// Las tres opacidades son nodos Animated derivados de `pan`: se mueve el
// arrastre y se leen los valores resultantes.
function opacidadesEn(dx, dy) {
  const pan = new Animated.ValueXY({ x: dx, y: dy });
  const { knew, forgot, middle } = swipeOpacities(pan, UMBRAL);
  return {
    good: knew.__getValue(),
    again: forgot.__getValue(),
    hard: middle.__getValue(),
  };
}

const visibles = (o) =>
  Object.entries(o)
    .filter(([, v]) => v > 0.01)
    .map(([k]) => k);

test("en reposo no se ve ninguna señal", () => {
  expect(visibles(opacidadesEn(0, 0))).toEqual([]);
});

test("cada dirección pura enciende solo su señal", () => {
  expect(visibles(opacidadesEn(UMBRAL, 0))).toEqual(["good"]);
  expect(visibles(opacidadesEn(-UMBRAL, 0))).toEqual(["again"]);
  expect(visibles(opacidadesEn(0, -UMBRAL))).toEqual(["hard"]);
});

test("en diagonal gana el eje dominante y NUNCA se ven dos a la vez", () => {
  // Este es el motivo del cambio: antes cada opacidad salía de su propio eje y
  // una diagonal encendía dos pills a la vez.
  const diagonales = [
    [70, -30],
    [-70, -30],
    [30, -70],
    [-30, -70],
    [80, -20],
    [-15, -85],
    [200, -200 + 20],
  ];
  for (const [dx, dy] of diagonales) {
    expect(visibles(opacidadesEn(dx, dy))).toHaveLength(1);
  }
});

test("en la diagonal exacta ninguna señal queda a pleno", () => {
  // Empate: el cruce reparte y ninguna de las dos domina la pantalla.
  const o = opacidadesEn(60, -60);
  expect(o.good).toBeLessThan(1);
  expect(o.hard).toBeLessThan(1);
});

test("la señal se satura al llegar al umbral y no se pasa", () => {
  expect(opacidadesEn(UMBRAL * 3, 0).good).toBe(1);
  expect(opacidadesEn(-UMBRAL * 3, 0).again).toBe(1);
  expect(opacidadesEn(0, -UMBRAL * 3).hard).toBe(1);
});

test("arrastrar hacia abajo no enciende nada", () => {
  expect(visibles(opacidadesEn(0, UMBRAL))).toEqual([]);
});
