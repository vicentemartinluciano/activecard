import { createStudyMotion } from '../studyMotion';

function setup() {
  const animations = [];
  const grade = jest.fn(() => Promise.resolve());
  const callbacks = { setPosition: jest.fn(), paint: jest.fn(), clear: jest.fn(), getGrade: () => grade };
  const motion = createStudyMotion({
    ...callbacks,
    getTarget: (rating) => rating === 'hard' ? { x: 0, y: -600 } : { x: rating === 'good' ? 900 : -900, y: 0 },
    animate: (target, duration, done) => {
      const animation = { target, duration, done, stop: jest.fn(() => done({ finished: false })) };
      animations.push(animation); return animation;
    },
  });
  return { ...callbacks, motion, animations, grade };
}

test.each(['good', 'again', 'hard'])('el vuelo %s pinta y anima antes de registrar una sola nota', async (rating) => {
  const s = setup(); const first = s.motion.swipe(rating);
  expect(s.grade).not.toHaveBeenCalled(); expect(s.motion.isBusy()).toBe(true);
  expect(s.paint).toHaveBeenCalled(); expect(s.animations[0].duration).toBe(200);
  expect(await s.motion.swipe(rating)).toBe(false);
  s.animations[0].done({ finished: true });
  expect(await first).toBe(true); expect(s.grade).toHaveBeenCalledTimes(1);
  expect(s.setPosition).toHaveBeenLastCalledWith({ x: 0, y: 0 });
  expect(s.motion.isBusy()).toBe(false);
});

test('un retorno incompleto se corrige al terminar y un nuevo arrastre interrumpe el retorno sin saltar', () => {
  const s = setup(); s.motion.move({ dx: 40, dy: 10 }); s.motion.cancel();
  s.animations[0].done({ finished: false });
  expect(s.setPosition).toHaveBeenLastCalledWith({ x: 0, y: 0 });
  s.motion.cancel(); s.motion.move({ dx: 50, dy: 0 });
  expect(s.animations[1].stop).toHaveBeenCalled();
  expect(s.setPosition).toHaveBeenLastCalledWith({ x: 50, y: 0 });
  expect(s.grade).not.toHaveBeenCalled();
});

test('un vuelo interrumpido retorna sin calificar', async () => {
  const s = setup(); const result = s.motion.swipe('hard');
  s.animations[0].done({ finished: false });
  expect(await result).toBe(false); expect(s.grade).not.toHaveBeenCalled();
  expect(s.setPosition).toHaveBeenLastCalledWith({ x: 0, y: 0 });
});

test('un cambio de tarjeta o desmontaje invalida el vuelo viejo', async () => {
  const s = setup(); const result = s.motion.swipe('good'); s.motion.reset();
  s.animations[0].done({ finished: true });
  expect(await result).toBe(false); expect(s.grade).not.toHaveBeenCalled();
  expect(s.motion.isBusy()).toBe(false);
});

test('el bloqueo dura hasta guardar en SQLite y un error devuelve al centro', async () => {
  const s = setup(); let reject;
  s.grade.mockImplementation(() => new Promise((_, fail) => { reject = fail; }));
  const result = s.motion.swipe('again'); s.animations[0].done({ finished: true });
  expect(s.motion.isBusy()).toBe(true); expect(await s.motion.swipe('good')).toBe(false);
  s.motion.cancel(); expect(s.animations).toHaveLength(1);
  const caught = expect(result).rejects.toThrow('SQLite'); reject(new Error('SQLite'));
  await caught; expect(s.motion.isBusy()).toBe(false);
  expect(s.setPosition).toHaveBeenLastCalledWith({ x: 0, y: 0 });
});
