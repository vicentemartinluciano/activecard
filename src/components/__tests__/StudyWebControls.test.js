/** @jest-environment jsdom */
import React, { act, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Animated } from 'react-native';

import FlipCard from '../FlipCard';
import SwipeCard from '../SwipeCard';
import useStudyKeyboard from '../useStudyKeyboard';

// RN Web real, incluyendo PressResponder y sus botones; un mock nativo o un
// DIV aislado no reproduce las interacciones de la cara y sus controles.
jest.mock('react-native', () => jest.requireActual('react-native-web'));
jest.mock('expo-router', () => ({
  useFocusEffect: (callback) => require('react').useEffect(callback, [callback]),
}));
jest.mock('@expo/vector-icons/Feather', () => () => null);
jest.mock('@expo/vector-icons/FontAwesome', () => () => null);
jest.mock('../RichText', () => ({ __esModule: true, default: ({ text }) =>
  require('react').createElement(require('react-native').Text, null, text) }));

let root;
let container;
const flip = jest.fn();
const grade = jest.fn().mockResolvedValue(undefined);
const star = jest.fn();

beforeAll(() => {
  // El preset Expo nativo instala un fetch lazy. Esta prueba DOM no usa red;
  // evitar que el teardown lo resuelva e intente iniciar módulos nativos.
  Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: jest.fn() });
});

function Study() {
  const [flipped, setFlipped] = useState(false);
  const [index, setIndex] = useState(0);
  const swipeRef = useRef(null);
  const turn = () => { flip(); setFlipped((value) => !value); };
  const save = async (rating) => {
    await grade(rating);
    setFlipped(false);
    setIndex((value) => value + 1);
  };
  useStudyKeyboard({ enabled: true, flipped, flip: turn,
    grade: (rating) => swipeRef.current.swipe(rating), isBusy: () => swipeRef.current.isBusy() });
  return <><SwipeCard ref={swipeRef} cardId={index + 1}
    onSwipeLeft={() => save('again')} onSwipeUp={() => save('hard')} onSwipeRight={() => save('good')}>
    <FlipCard cardId={index + 1} front={`Pregunta de prueba ${index + 1}`} back={`Respuesta de prueba ${index + 1}`}
      flipped={flipped} onFlip={turn} starred={false} onToggleStar={star} />
  </SwipeCard><button data-study-rating="good" onClick={() => swipeRef.current.swipe('good')}>La recordé</button></>;
}

beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  jest.spyOn(Animated, 'timing').mockImplementation((value, { toValue }) => ({
    start: (done) => { value.setValue(toValue); done?.({ finished: true }); }, stop: () => {},
  }));
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<Study />));
  const frame = container.querySelector('[data-study-drag]');
  frame.setPointerCapture = jest.fn();
  frame.hasPointerCapture = () => true;
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

async function key(target, value, extra = {}) {
  await act(async () => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true, ...extra }));
    target.dispatchEvent(new KeyboardEvent('keyup', { key: value, bubbles: true, cancelable: true }));
  });
}

test('la superficie accesible no anida botones y Espacio gira una sola vez', async () => {
  const face = container.querySelector('[data-study-flip]');
  expect(face.getAttribute('role')).toBe('button');
  expect(container.querySelector('button button')).toBeNull();
  await act(async () => face.focus());
  await key(face, ' ');
  expect(container.textContent).toContain('Respuesta de prueba');
  expect(flip).toHaveBeenCalledTimes(1);
  await key(face, ' ');
  expect(container.textContent).toContain('Pregunta de prueba');
  expect(flip).toHaveBeenCalledTimes(2);
});

test.each([['1', 'again'], ['2', 'hard'], ['3', 'good'], ['ArrowRight', 'good']])(
  '%s califica después de revelar y enfocar la cara', async (value, rating) => {
    await key(container.querySelector('[data-study-drag]'), ' ');
    const face = container.querySelector('[data-study-flip]');
    await act(async () => face.focus());
    await key(face, value);
    expect(grade).toHaveBeenCalledTimes(1);
    expect(grade).toHaveBeenCalledWith(rating);
  });

test.each([['1', 'again'], ['2', 'hard'], ['3', 'good'],
  ['ArrowLeft', 'again'], ['ArrowUp', 'hard'], ['ArrowRight', 'good']])(
  '%s califica desde la pregunta con foco en el texto y permite seguir', async (value, rating) => {
    const text = container.querySelector('[data-study-flip-text]');
    await act(async () => text.focus());
    expect(document.activeElement).toBe(text);
    await key(text, value);
    expect(grade.mock.calls).toEqual([[rating]]);
    expect(flip).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Pregunta de prueba 2');
    expect(document.activeElement).toBe(container.querySelector('[data-study-drag]'));
    await key(document.activeElement, value);
    expect(grade.mock.calls).toEqual([[rating], [rating]]);
    expect(container.textContent).toContain('Pregunta de prueba 3');
  });

test('la cara y el texto no muestran el marco nativo; la estrella sigue accesible', () => {
  const face = container.querySelector('[data-study-flip]');
  const text = container.querySelector('[data-study-flip-text]');
  expect(face.style.outline).toBe('none');
  expect(face.tabIndex).toBe(0);
  expect(text.tabIndex).toBe(-1);
  expect(getComputedStyle(text).outlineStyle).toBe('none');
  const starButton = container.querySelector('[data-study-action="star"]');
  expect(starButton.tabIndex).toBe(0);
  expect(starButton.style.outlineStyle).not.toBe('none');
});

test('el doble clic sobre texto de la cara arma el arrastre y otro clic califica', async () => {
  const face = container.querySelector('[data-study-flip]');
  const text = [...face.querySelectorAll('div')].find((node) => node.textContent === 'Pregunta de prueba 1');
  const pointer = (type, x) => {
    const event = new MouseEvent(type, { button: 0, buttons: type === 'pointerdown' ? 1 : 0,
      clientX: x, clientY: 200, bubbles: true, cancelable: true });
    Object.defineProperties(event, { pointerId: { value: 1 }, pointerType: { value: 'mouse' } });
    text.dispatchEvent(event);
  };
  await act(async () => {
    pointer('pointerdown', 20); pointer('pointerup', 20);
    text.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    pointer('pointerdown', 20); pointer('pointerup', 20);
    text.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    pointer('pointermove', 160);
    pointer('pointerdown', 160); pointer('pointerup', 160);
    text.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
  expect(flip).toHaveBeenCalledTimes(1);
  expect(grade).toHaveBeenCalledTimes(1);
  expect(grade).toHaveBeenCalledWith('good');
});

test('Espacio sobre la estrella no dispara giro ni calificación', async () => {
  const button = container.querySelector('[data-study-action="star"]');
  await act(async () => button.focus());
  await key(button, ' ');
  await act(async () => button.click());
  expect(star).toHaveBeenCalledTimes(1);
  expect(flip).not.toHaveBeenCalled();
  expect(grade).not.toHaveBeenCalled();
});

test('tras calificar con un botón vuelve el foco y permite seguir con Espacio y números', async () => {
  const button = container.querySelector('[data-study-rating="good"]');
  await act(async () => { button.focus(); button.click(); });
  const frame = container.querySelector('[data-study-drag]');
  expect(document.activeElement).toBe(frame);
  expect(container.textContent).toContain('Pregunta de prueba 2');
  await key(frame, ' ');
  expect(container.textContent).toContain('Respuesta de prueba 2');
  await key(container.querySelector('[data-study-flip]'), '2');
  expect(grade.mock.calls).toEqual([['good'], ['hard']]);
  expect(container.textContent).toContain('Pregunta de prueba 3');
  expect(document.activeElement).toBe(frame);
});

test.each([{ ctrlKey: true }, { altKey: true }, { metaKey: true }, { isComposing: true }, { repeat: true }])(
  'la cara no gira ni califica con modificadores, composición o repetición: %s', async (extra) => {
    await key(container.querySelector('[data-study-flip]'), ' ', extra);
    expect(flip).not.toHaveBeenCalled();
    expect(grade).not.toHaveBeenCalled();
  });

test('los atajos dejan escribir en un campo con foco', async () => {
  const input = document.createElement('input');
  container.append(input);
  input.focus();
  await key(input, ' ');
  await key(input, '3');
  expect(flip).not.toHaveBeenCalled();
  expect(grade).not.toHaveBeenCalled();
});
