// Dos toques activan el arrastre sin mantener el segundo. Otro toque lo suelta.
// Los controles internos, Escape y la pérdida de foco cancelan sin calificar.
export function studyDragDirection(dx, dy, threshold = 90) {
  if (Math.abs(dx) >= Math.abs(dy) && Math.abs(dx) > threshold) return dx > 0 ? 'good' : 'again';
  if (dy < -threshold && Math.abs(dy) > Math.abs(dx)) return 'hard';
  return null;
}

export function createStudyMouseDrag({ move, release, cancel, isBusy = () => false, onArmedChange = () => {}, now = Date.now }) {
  let lastTap = null;
  let firstPress = null;
  let drag = null;
  let suppressClick = false;
  const consume = (event) => { event.preventDefault(); event.stopPropagation(); };
  const reset = () => {
    const wasDragging = !!drag;
    drag = null; firstPress = null; lastTap = null;
    onArmedChange(false);
    if (wasDragging) cancel();
  };
  const finish = (event) => {
    const direction = studyDragDirection(event.clientX - drag.x, event.clientY - drag.y);
    drag = null; firstPress = null; lastTap = null;
    onArmedChange(false);
    if (direction) release(direction); else cancel();
    consume(event);
  };
  const state = { reset };
  state.handlers = {
    onPointerDownCapture(event) {
      if (event.button !== 0 || event.isPrimary === false) return;
      suppressClick = false;
      if (event.target.closest?.('[data-study-action], button, input, textarea, a')) { reset(); return; }
      if (isBusy()) { suppressClick = true; consume(event); return; }
      if (drag) {
        // El mouse ya movió la tarjeta sin botones. En tacto, el tercer toque
        // inicia un arrastre nuevo desde ese punto (sin saltar al apoyar el dedo).
        if (event.pointerType !== 'mouse') {
          drag.x = event.clientX; drag.y = event.clientY;
          move({ dx: 0, dy: 0 });
        }
        drag.id = event.pointerId; drag.finishOnUp = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        suppressClick = true; consume(event); return;
      }
      const point = { x: event.clientX, y: event.clientY, time: now(), id: event.pointerId, type: event.pointerType };
      if (lastTap && point.type === lastTap.type && point.time - lastTap.time <= 360 && Math.hypot(point.x - lastTap.x, point.y - lastTap.y) <= 18) {
        drag = { ...point, finishOnUp: false }; firstPress = null; lastTap = null; suppressClick = true;
        onArmedChange(true);
        event.currentTarget.setPointerCapture(event.pointerId);
        consume(event);
      } else { firstPress = point; }
    },
    onPointerMoveCapture(event) {
      if (!drag || event.pointerId !== drag.id) return;
      // Protección si se pierde el pointerup fuera de la ventana.
      if (drag.finishOnUp && event.pointerType === 'mouse' && event.buttons === 0) { reset(); return; }
      move({ dx: event.clientX - drag.x, dy: event.clientY - drag.y });
      consume(event);
    },
    onPointerUpCapture(event) {
      if (drag && event.pointerId === drag.id) {
        if (drag.finishOnUp || Math.hypot(event.clientX - drag.x, event.clientY - drag.y) >= 8) finish(event);
        else { drag.id = event.pointerId; consume(event); }
      } else if (firstPress?.id === event.pointerId) {
        lastTap = Math.hypot(event.clientX - firstPress.x, event.clientY - firstPress.y) < 8
          ? { ...firstPress, time: now() } : null;
        firstPress = null;
      }
    },
    onPointerCancel: reset,
    // La captura se libera normalmente al terminar el segundo toque: el modo
    // activado sigue esperando movimiento. Si se pierde mientras se sostiene,
    // volvemos al centro en vez de dejar una tarjeta colgada.
    onLostPointerCapture() { if (drag?.finishOnUp) reset(); },
    onPointerLeave(event) { if (drag && !event.currentTarget.hasPointerCapture?.(drag.id)) reset(); },
    onClickCapture(event) { if (suppressClick) { consume(event); suppressClick = false; } },
  };
  return state;
}
