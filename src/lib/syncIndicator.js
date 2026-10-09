export function syncIndicator(status) {
  if (!status?.user) return { synced: false, label: 'Sin conectar' };
  if (status.error) return { synced: false, label: 'Revisar conexión' };
  if (status.busy) return { synced: false, label: 'Sincronizando' };
  if (status.pending || status.localPending !== false) return { synced: false, label: 'Cambios pendientes' };
  if (!status.syncedAt) return { synced: false, label: 'Sincronización sin confirmar' };
  return { synced: true, label: 'Al día' };
}
