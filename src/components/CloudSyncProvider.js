import { usePathname } from "expo-router";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import { getDb } from "../db/client";
import { subscribeDatabaseChanges } from "../db/transactions";
import { readLocalSync } from "../lib/syncLocal";
import { createSyncEngine } from "../lib/syncEngine";
import { createSyncRemote } from "../lib/syncRemote";

const Context = createContext(null);
export const useCloudSync = () => useContext(Context);
export default function CloudSyncProvider({ children }) {
  const path = usePathname();
  const safe = useRef(false);
  const holds = useRef(0);
  const generation = useRef(0);
  const mounted = useRef(true);
  const hold = useCallback(() => { holds.current++; return () => { holds.current--; }; }, []);
  safe.current = path === "/ajustes";
  const [status, setStatus] = useState({ user: null, busy: false, localPending: true, message: "Conectá tu cuenta de REANCLA para sincronizar" });
  const onStatus = useCallback((update) => {
    setStatus((current) => ({ ...current, ...update, ...(current.user?.id !== update.user?.id || (Platform.OS === 'web' && update.syncedAt) ? { localPending: true } : {}) }));
    if (Platform.OS !== 'web' || !update.user || !update.syncedAt) return;
    const observed = generation.current;
    readLocalSync(update.user.id).then((local) => {
      if (!mounted.current) return;
      setStatus((current) => current.user?.id === update.user.id && current.syncedAt === update.syncedAt
        ? { ...current, localPending: !local.clean || generation.current !== observed } : current);
    }).catch(() => { /* Sin verificación local el indicador conserva su estado pendiente. */ });
  }, []);
  const [engine] = useState(() => createSyncEngine({ remote: createSyncRemote(), canApply: () => safe.current && holds.current === 0 && AppState.currentState !== "background", onStatus }));
  useEffect(() => {
    mounted.current = true;
    let unsubscribe;
    let active = true;
    if (Platform.OS === 'web') getDb().then((db) => {
      if (!active) return;
      unsubscribe = subscribeDatabaseChanges(db, () => {
        generation.current++;
        setStatus((current) => ({ ...current, localPending: true }));
      });
    }).catch(() => {});
    return () => { active = false; mounted.current = false; unsubscribe?.(); };
  }, []);
  useEffect(() => {
    engine.restore();
    const timer = setInterval(() => { if (AppState.currentState !== "background") engine.sync(); }, 30000);
    const subscription = AppState.addEventListener("change", (state) => { if (state === "active") engine.sync(); });
    return () => { clearInterval(timer); subscription.remove(); };
  }, [engine]);
  useEffect(() => { engine.sync(); }, [path, engine]);
  return <Context.Provider value={{ status, engine, hold }}>{children}</Context.Provider>;
}
