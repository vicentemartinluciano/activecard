import { useEffect } from 'react';
import { AppState } from 'react-native';
import { getDb } from '../db/client';
import { subscribeDatabaseChanges } from '../db/transactions';
import { createWidgetRefreshScheduler } from '../widgets/refreshScheduler';
import { refreshInstalledWidgets } from '../widgets/runtime.android';

export default function WidgetUpdates() {
  useEffect(() => {
    let active = true;
    let unsubscribe;
    const scheduler = createWidgetRefreshScheduler(refreshInstalledWidgets, () => {
      console.warn('No se pudieron actualizar los widgets de ActiveCard.');
    });
    getDb().then((db) => {
      if (!active) return;
      unsubscribe = subscribeDatabaseChanges(db, scheduler.request);
      scheduler.flush();
    }).catch(() => {});
    const subscription = AppState.addEventListener('change', () => scheduler.flush());
    // Captura el cambio de día/huso con la app abierta; Android refresca en segundo plano.
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') scheduler.request();
    }, 60000);
    return () => {
      active = false;
      unsubscribe?.();
      subscription.remove();
      clearInterval(timer);
      scheduler.dispose();
    };
  }, []);
  return null;
}
