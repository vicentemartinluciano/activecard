import { createWidgetRefreshScheduler } from '../refreshScheduler';
beforeEach(() => { jest.useFakeTimers(); });
afterEach(() => { jest.useRealTimers(); });
test('agrupa las escrituras de review y log en un solo refresco', async () => {
  const refresh = jest.fn().mockResolvedValue();
  const scheduler = createWidgetRefreshScheduler(refresh, jest.fn());
  scheduler.request(); scheduler.request(); scheduler.request();
  await jest.advanceTimersByTimeAsync(300);
  expect(refresh).toHaveBeenCalledTimes(1);
  scheduler.dispose();
});
test('un cambio durante una lectura se vuelve a renderizar, sin paralelismo ni datos viejos al final', async () => {
  let release;
  const refresh = jest.fn().mockImplementationOnce(() => new Promise((resolve) => { release = resolve; })).mockResolvedValue();
  const scheduler = createWidgetRefreshScheduler(refresh, jest.fn());
  const pending = scheduler.flush();
  scheduler.request(); scheduler.request();
  expect(refresh).toHaveBeenCalledTimes(1);
  release(); await pending;
  expect(refresh).toHaveBeenCalledTimes(2);
  await jest.advanceTimersByTimeAsync(1000);
  expect(refresh).toHaveBeenCalledTimes(2);
  scheduler.dispose();
});
test('flush al cerrar/volver evita depender del debounce y dispose cancela actualizaciones', async () => {
  const refresh = jest.fn().mockResolvedValue();
  const scheduler = createWidgetRefreshScheduler(refresh, jest.fn());
  scheduler.request(); await scheduler.flush();
  expect(refresh).toHaveBeenCalledTimes(1);
  scheduler.request(); scheduler.dispose();
  await jest.advanceTimersByTimeAsync(1000);
  await scheduler.flush();
  expect(refresh).toHaveBeenCalledTimes(1);
});
test('un error no impide reintentar con datos vigentes', async () => {
  const refresh = jest.fn().mockRejectedValueOnce(new Error('falló')).mockResolvedValue();
  const onError = jest.fn();
  const scheduler = createWidgetRefreshScheduler(refresh, onError);
  await scheduler.flush(); await scheduler.flush();
  expect(onError).toHaveBeenCalledTimes(1);
  expect(refresh).toHaveBeenCalledTimes(2);
  scheduler.dispose();
});
