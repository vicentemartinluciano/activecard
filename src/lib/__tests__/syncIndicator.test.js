import { syncIndicator } from '../syncIndicator';

const confirmed = { user: { id: 'account' }, syncedAt: '2026-10-08T15:00:00Z', localPending: false };
test('verde solo con una sincronización confirmada sin cambios pendientes', () => {
  expect(syncIndicator(confirmed)).toEqual({ synced: true, label: 'Al día' });
});
test.each([
  [undefined, 'Sin conectar'],
  [{ ...confirmed, user: null }, 'Sin conectar'],
  [{ ...confirmed, error: 'Sin conexión' }, 'Revisar conexión'],
  [{ ...confirmed, busy: true }, 'Sincronizando'],
  [{ ...confirmed, pending: true }, 'Cambios pendientes'],
  [{ ...confirmed, localPending: true }, 'Cambios pendientes'],
  [{ ...confirmed, localPending: undefined }, 'Cambios pendientes'],
  [{ ...confirmed, syncedAt: null }, 'Sincronización sin confirmar'],
])('el estado incompleto o pendiente queda neutro: %s', (status, label) => {
  expect(syncIndicator(status)).toEqual({ synced: false, label });
});
