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

// Montaje real: el nodo web carece de setNativeProps. El gesto debe poder
// pintar y retornar sin lanzar la excepción que dejaba la tarjeta trabada.
test('web vuelve al centro con un nodo DOM y anima los atajos antes de calificar', async () => {
  const React = require('react');
  const { act, create } = require('react-test-renderer');
  const { Platform } = require('react-native');
  const SwipeCard = require('../SwipeCard').default;
  const previousOS = Platform.OS;
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const previousAct = globalThis.IS_REACT_ACT_ENVIRONMENT;
  const clock = jest.spyOn(Date, 'now').mockReturnValue(1000);
  Platform.OS = 'web';
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = { addEventListener: jest.fn(), removeEventListener: jest.fn() };
  globalThis.document = { addEventListener: jest.fn(), removeEventListener: jest.fn() };
  const animations = [];
  const timing = jest.spyOn(Animated, 'timing').mockImplementation((value, config) => {
    const animation = { value, config, start: (done) => { animation.done = done; }, stop: jest.fn() };
    animations.push(animation); return animation;
  });
  const grade = jest.fn();
  const ref = React.createRef();
  const webNode = { focus: jest.fn() };
  const props = { ref, cardId: 1, onSwipeRight: grade };
  let tree;
  try {
    await act(async () => { tree = create(React.createElement(SwipeCard, props), { createNodeMock: (element) => element.props['data-study-drag'] ? webNode : ({ nodeType: 1 }) }); });
    expect(webNode.focus).toHaveBeenCalledWith({ preventScroll: true });
    const root = tree.root.findByType('div');
    const pointer = (x) => ({ button: 0, pointerType: 'mouse', pointerId: 1, clientX: x, clientY: 100, target: { closest: () => null }, currentTarget: { setPointerCapture: jest.fn() }, preventDefault: jest.fn(), stopPropagation: jest.fn() });
    await act(async () => {
      root.props.onPointerDownCapture(pointer(100)); root.props.onPointerUpCapture(pointer(100));
      root.props.onPointerDownCapture(pointer(100)); root.props.onPointerUpCapture(pointer(100));
      root.props.onPointerMoveCapture(pointer(140));
      root.props.onPointerDownCapture(pointer(140)); root.props.onPointerUpCapture(pointer(140));
    });
    const returning = animations.at(-1);
    expect(returning.config.toValue).toEqual({ x: 0, y: 0 });
    await act(async () => { returning.done({ finished: true }); });
    expect(returning.value.__getValue()).toEqual({ x: 0, y: 0 });
    expect(grade).not.toHaveBeenCalled();
    let result;
    await act(async () => { result = ref.current.swipe('good'); });
    const flight = animations.at(-1);
    expect(flight.config.toValue.x).toBeGreaterThan(90);
    expect(grade).not.toHaveBeenCalled();
    await act(async () => { flight.done({ finished: true }); await result; });
    expect(grade).toHaveBeenCalledTimes(1);
    globalThis.document.activeElement = { closest: () => null }; // botón de nota
    await act(async () => { tree.update(React.createElement(SwipeCard, { ...props, cardId: 2 })); });
    expect(webNode.focus).toHaveBeenCalledTimes(2);
    globalThis.document.activeElement = { closest: () => ({ tagName: 'INPUT' }) };
    await act(async () => { tree.update(React.createElement(SwipeCard, { ...props, cardId: 3 })); });
    expect(webNode.focus).toHaveBeenCalledTimes(2);
  } finally {
    if (tree) await act(async () => { tree.unmount(); });
    timing.mockRestore(); clock.mockRestore(); Platform.OS = previousOS;
    globalThis.window = previousWindow; globalThis.document = previousDocument;
    globalThis.IS_REACT_ACT_ENVIRONMENT = previousAct;
  }
});
