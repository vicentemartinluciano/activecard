import { usePathname } from "expo-router";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { createSyncEngine } from "../lib/syncEngine";
import { createSyncRemote } from "../lib/syncRemote";

const Context = createContext(null);
export const useCloudSync = () => useContext(Context);
export default function CloudSyncProvider({ children }) {
  const path = usePathname();
  const safe = useRef(false);
  const holds = useRef(0);
  const hold = useCallback(() => { holds.current++; return () => { holds.current--; }; }, []);
  safe.current = path === "/ajustes";
  const [status, setStatus] = useState({ user: null, busy: false, message: "Conectá tu cuenta de REANCLA para sincronizar" });
  const [engine] = useState(() => createSyncEngine({ remote: createSyncRemote(), canApply: () => safe.current && holds.current === 0 && AppState.currentState !== "background", onStatus: (update) => setStatus((current) => ({ ...current, ...update })) }));
  useEffect(() => {
    engine.restore();
    const timer = setInterval(() => { if (AppState.currentState !== "background") engine.sync(); }, 30000);
    const subscription = AppState.addEventListener("change", (state) => { if (state === "active") engine.sync(); });
    return () => { clearInterval(timer); subscription.remove(); };
  }, [engine]);
  useEffect(() => { engine.sync(); }, [path, engine]);
  return <Context.Provider value={{ status, engine, hold }}>{children}</Context.Provider>;
}
