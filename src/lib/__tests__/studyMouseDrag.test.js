import { createStudyMouseDrag } from '../studyMouseDrag';

function setup() {
  const callbacks = { move: jest.fn(), release: jest.fn(), cancel: jest.fn(), isBusy: jest.fn(() => false) };
  let time = 1000;
  const control = createStudyMouseDrag({ ...callbacks, now: () => time });
  const event = (x = 20, y = 200, extra = {}) => ({
    pointerType: 'mouse', button: 0, pointerId: 1, clientX: x, clientY: y,
    target: { closest: () => null }, currentTarget: { setPointerCapture: jest.fn() },
    preventDefault: jest.fn(), stopPropagation: jest.fn(), ...extra,
  });
  const tap = () => { control.handlers.onPointerDownCapture(event()); control.handlers.onPointerUpCapture(event()); time += 100; };
  return { ...callbacks, handlers: control.handlers, event, tap, advance: (ms) => { time += ms; } };
}

test('un clic y un arrastre simple no califican ni bloquean el giro', () => {
  const s = setup();
  const click = s.event();
  s.handlers.onPointerDownCapture(click);
  s.handlers.onPointerMoveCapture(s.event(150));
  s.handlers.onPointerUpCapture(s.event(150));
  s.handlers.onClickCapture(click);
  expect(s.move).not.toHaveBeenCalled(); expect(s.release).not.toHaveBeenCalled();
  expect(click.preventDefault).not.toHaveBeenCalled();
});

test.each([[140, 200, 'good'], [-100, 200, 'again'], [45, 65, 'hard']])('el segundo clic mantenido califica una sola vez: %s,%s', (x, y, rating) => {
  const s = setup(); s.tap();
  const second = s.event(); s.handlers.onPointerDownCapture(second);
  expect(second.currentTarget.setPointerCapture).toHaveBeenCalledWith(1);
  s.handlers.onPointerMoveCapture(s.event(x, y));
  s.handlers.onPointerUpCapture(s.event(x, y));
  s.handlers.onPointerUpCapture(s.event(x, y));
  s.handlers.onLostPointerCapture(s.event());
  s.handlers.onClickCapture(second);
  expect(s.release).toHaveBeenCalledTimes(1); expect(s.release).toHaveBeenCalledWith(rating);
  expect(s.cancel).not.toHaveBeenCalled(); expect(second.preventDefault).toHaveBeenCalled();
});

test('soltar bajo el umbral o cancelar devuelve la tarjeta sin repaso', () => {
  const s = setup(); s.tap(); s.handlers.onPointerDownCapture(s.event());
  s.handlers.onPointerUpCapture(s.event(60, 210));
  expect(s.cancel).toHaveBeenCalledTimes(1); expect(s.release).not.toHaveBeenCalled();
  s.tap(); s.handlers.onPointerDownCapture(s.event()); s.handlers.onPointerCancel(s.event());
  expect(s.cancel).toHaveBeenCalledTimes(2); expect(s.release).not.toHaveBeenCalled();
});

test('un clic tardío, en otro lugar, sobre un control o táctil no arma el gesto', () => {
  for (const second of ['late', 'far', 'button', 'touch']) {
    const s = setup(); s.tap(); if (second === 'late') s.advance(500);
    const event = s.event(second === 'far' ? 200 : 20, 200, second === 'button'
      ? { target: { closest: () => ({}) } } : second === 'touch' ? { pointerType: 'touch' } : {});
    s.handlers.onPointerDownCapture(event); s.handlers.onPointerMoveCapture(s.event(150));
    s.handlers.onPointerUpCapture(s.event(150)); expect(s.release).not.toHaveBeenCalled();
  }
});

test('durante el vuelo se bloquea otro clic y otro repaso', () => {
  const s = setup(); s.tap(); s.isBusy.mockReturnValue(true);
  const click = s.event(); s.handlers.onPointerDownCapture(click); s.handlers.onPointerUpCapture(s.event(150));
  s.handlers.onClickCapture(click); expect(click.preventDefault).toHaveBeenCalled();
  expect(s.release).not.toHaveBeenCalled();
});
