// El primer clic gira; el segundo, mantenido, arrastra. Los controles internos
// no arman el gesto y una cancelación jamás registra un repaso.
export function studyDragDirection(dx, dy, threshold = 90) {
  if (Math.abs(dx) >= Math.abs(dy) && Math.abs(dx) > threshold) return dx > 0 ? 'good' : 'again';
  if (dy < -threshold && Math.abs(dy) > Math.abs(dx)) return 'hard';
  return null;
}

export function createStudyMouseDrag({ move, release, cancel, isBusy = () => false, now = Date.now }) {
  let lastTap = null;
  let firstPress = null;
  let drag = null;
  let suppressClick = false;
  const state = { isMouse: false };
  const consume = (event) => { event.preventDefault(); event.stopPropagation(); };
  const reset = () => {
    if (drag) cancel();
    drag = null; firstPress = null; lastTap = null;
  };
  state.handlers = {
    onPointerDownCapture(event) {
      state.isMouse = event.pointerType === 'mouse';
      if (!state.isMouse || event.button !== 0) return;
      suppressClick = false;
      if (event.target.closest?.('[data-study-action], button, input, textarea, a')) { lastTap = null; return; }
      if (isBusy()) { suppressClick = true; consume(event); return; }
      const point = { x: event.clientX, y: event.clientY, time: now(), id: event.pointerId };
      if (lastTap && point.time - lastTap.time <= 360 && Math.hypot(point.x - lastTap.x, point.y - lastTap.y) <= 18) {
        drag = point; firstPress = null; lastTap = null; suppressClick = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        consume(event);
      } else { firstPress = point; }
    },
    onPointerMoveCapture(event) {
      if (!drag || event.pointerId !== drag.id) return;
      move({ dx: event.clientX - drag.x, dy: event.clientY - drag.y });
      consume(event);
    },
    onPointerUpCapture(event) {
      if (drag && event.pointerId === drag.id) {
        const direction = studyDragDirection(event.clientX - drag.x, event.clientY - drag.y);
        drag = null; firstPress = null; lastTap = null;
        if (direction) release(direction); else cancel();
        consume(event);
      } else if (firstPress?.id === event.pointerId) {
        lastTap = Math.hypot(event.clientX - firstPress.x, event.clientY - firstPress.y) < 8
          ? { ...firstPress, time: now() } : null;
        firstPress = null;
      }
    },
    onPointerCancel: reset,
    onLostPointerCapture: reset,
    onClickCapture(event) { if (suppressClick) { consume(event); suppressClick = false; } },
  };
  return state;
}
