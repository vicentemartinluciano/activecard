import { createStudyMouseDrag } from '../studyMouseDrag';

function setup() {
  const callbacks = { move: jest.fn(), release: jest.fn(), cancel: jest.fn(), onArmedChange: jest.fn(), isBusy: jest.fn(() => false) };
  let time = 1000;
  const control = createStudyMouseDrag({ ...callbacks, now: () => time });
  const event = (x = 20, y = 200, extra = {}) => ({
    pointerType: 'mouse', button: 0, buttons: 0, pointerId: 1, clientX: x, clientY: y,
    target: { closest: () => null }, currentTarget: { setPointerCapture: jest.fn(), hasPointerCapture: () => false },
    preventDefault: jest.fn(), stopPropagation: jest.fn(), ...extra,
  });
  const tap = (extra = {}) => {
    const e = event(20, 200, extra);
    control.handlers.onPointerDownCapture(e); control.handlers.onPointerUpCapture(e);
    control.handlers.onClickCapture(e); time += 100;
    return e;
  };
  return { ...callbacks, ...control, event, tap, advance: (ms) => { time += ms; } };
}

test('un toque y un arrastre simple no califican ni bloquean el giro', () => {
  const s = setup(); const click = s.event();
  s.handlers.onPointerDownCapture(click);
  s.handlers.onPointerMoveCapture(s.event(150));
  s.handlers.onPointerUpCapture(s.event(150));
  s.handlers.onClickCapture(click);
  expect(s.move).not.toHaveBeenCalled(); expect(s.release).not.toHaveBeenCalled();
  expect(click.preventDefault).not.toHaveBeenCalled();
});

test.each([[140, 200, 'good'], [-100, 200, 'again'], [45, 65, 'hard']])('dos toques completos permiten mover sin botones y soltar con otro toque: %s,%s', (x, y, rating) => {
  const s = setup(); const first = s.tap(); const second = s.tap();
  expect(first.preventDefault).not.toHaveBeenCalled();
  expect(second.preventDefault).toHaveBeenCalled();
  // La liberación automática de captura tras el segundo toque no desarma.
  s.handlers.onLostPointerCapture(s.event());
  s.handlers.onPointerMoveCapture(s.event(x, y));
  expect(s.move).toHaveBeenCalledWith({ dx: x - 20, dy: y - 200 });
  expect(s.release).not.toHaveBeenCalled();
  s.handlers.onPointerDownCapture(s.event(x, y));
  s.handlers.onPointerUpCapture(s.event(x, y));
  s.handlers.onPointerUpCapture(s.event(x, y));
  s.handlers.onLostPointerCapture(s.event());
  expect(s.release).toHaveBeenCalledTimes(1); expect(s.release).toHaveBeenCalledWith(rating);
  expect(s.cancel).not.toHaveBeenCalled();
});

test('soltar a mitad de camino retorna y permite iniciar otro gesto', () => {
  const s = setup(); s.tap(); s.tap();
  s.handlers.onPointerMoveCapture(s.event(60, 210));
  s.handlers.onPointerDownCapture(s.event(60, 210));
  s.handlers.onPointerUpCapture(s.event(60, 210));
  expect(s.cancel).toHaveBeenCalledTimes(1); expect(s.release).not.toHaveBeenCalled();
  s.tap(); s.tap(); s.handlers.onPointerMoveCapture(s.event(160));
  s.handlers.onPointerDownCapture(s.event(160)); s.handlers.onPointerUpCapture(s.event(160));
  expect(s.release).toHaveBeenCalledWith('good');
});

test.each(['onPointerCancel', 'onPointerLeave', 'reset'])('cancelar con %s devuelve sin registrar repaso', (method) => {
  const s = setup(); s.tap(); s.tap(); s.handlers.onPointerMoveCapture(s.event(60));
  if (method === 'reset') s.reset(); else s.handlers[method](s.event());
  s.handlers.onPointerMoveCapture(s.event(160));
  expect(s.cancel).toHaveBeenCalledTimes(1); expect(s.release).not.toHaveBeenCalled();
  expect(s.onArmedChange).toHaveBeenLastCalledWith(false);
});

test('en una pantalla táctil se puede apoyar de nuevo y arrastrar después del doble toque', () => {
  const s = setup(); const touch = { pointerType: 'touch' };
  s.tap(touch); s.tap(touch);
  s.handlers.onLostPointerCapture(s.event(20, 200, touch));
  s.handlers.onPointerDownCapture(s.event(50, 180, touch));
  s.handlers.onPointerMoveCapture(s.event(170, 180, touch));
  s.handlers.onPointerUpCapture(s.event(170, 180, touch));
  expect(s.move).toHaveBeenLastCalledWith({ dx: 120, dy: 0 });
  expect(s.release).toHaveBeenCalledWith('good');
});

test('un toque tardío, lejano o sobre un control no arma el gesto', () => {
  for (const second of ['late', 'far', 'button']) {
    const s = setup(); s.tap(); if (second === 'late') s.advance(500);
    const event = s.event(second === 'far' ? 200 : 20, 200, second === 'button' ? { target: { closest: () => ({}) } } : {});
    s.handlers.onPointerDownCapture(event); s.handlers.onPointerMoveCapture(s.event(150));
    s.handlers.onPointerUpCapture(s.event(150)); expect(s.release).not.toHaveBeenCalled();
  }
});

test('un control interno cancela un gesto ya activado sin bloquear su acción', () => {
  const s = setup(); s.tap(); s.tap(); s.handlers.onPointerMoveCapture(s.event(60));
  const control = s.event(20, 200, { target: { closest: () => ({}) } });
  s.handlers.onPointerDownCapture(control);
  expect(s.cancel).toHaveBeenCalledTimes(1); expect(control.preventDefault).not.toHaveBeenCalled();
});

test('la captura perdida mientras se sostiene o un pointerup perdido cancela', () => {
  for (const loseCapture of [true, false]) {
    const s = setup(); s.tap(); s.tap(); s.handlers.onPointerDownCapture(s.event());
    if (loseCapture) s.handlers.onLostPointerCapture(s.event());
    else s.handlers.onPointerMoveCapture(s.event(70));
    expect(s.cancel).toHaveBeenCalledTimes(1); expect(s.release).not.toHaveBeenCalled();
  }
});

test('durante el vuelo se bloquea otro toque y otro repaso', () => {
  const s = setup(); s.tap(); s.isBusy.mockReturnValue(true);
  const click = s.event(); s.handlers.onPointerDownCapture(click); s.handlers.onPointerUpCapture(s.event(150));
  s.handlers.onClickCapture(click); expect(click.preventDefault).toHaveBeenCalled();
  expect(s.release).not.toHaveBeenCalled();
});
