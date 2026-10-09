// Mouse, tacto y teclado comparten el vuelo y el bloqueo hasta guardar la nota.
export function createStudyMotion({ animate, setPosition, paint, clear, getTarget, getGrade }) {
  let animation = null;
  let flight = null;
  let generation = 0;

  const stop = () => {
    generation += 1;
    animation?.stop();
    animation = null;
  };
  const reset = () => { setPosition({ x: 0, y: 0 }); clear(); };

  return {
    isBusy: () => flight !== null,
    move(gesture) {
      if (flight) return;
      stop();
      setPosition({ x: gesture.dx, y: gesture.dy });
      paint(gesture);
    },
    cancel() {
      if (flight) return;
      stop();
      clear();
      const current = generation;
      animation = animate({ x: 0, y: 0 }, 130, () => {
        if (generation === current) reset();
      });
    },
    swipe(rating) {
      if (flight || !getGrade(rating)) return Promise.resolve(false);
      stop();
      const current = generation;
      const target = getTarget(rating);
      paint({ dx: target.x, dy: target.y });
      return new Promise((resolve, reject) => {
        flight = { resolve };
        animation = animate(target, 200, async ({ finished }) => {
          if (generation !== current) return;
          reset();
          try {
            if (finished) await getGrade(rating)();
            resolve(finished);
          } catch (error) { reject(error); }
          finally { if (generation === current) flight = null; }
        });
      });
    },
    reset() {
      stop();
      flight?.resolve(false);
      flight = null;
      reset();
    },
  };
}
