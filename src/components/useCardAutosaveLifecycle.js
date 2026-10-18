import { useEffect } from "react";
import { AppState, Platform } from "react-native";

export default function useCardAutosaveLifecycle(autosaveRef) {
  useEffect(() => {
    const subscription = AppState?.addEventListener("change", (state) => {
      if (state !== "active") autosaveRef.current?.flush();
    });
    const flush = () => { autosaveRef.current?.flush(); };
    const warn = (event) => {
      if (autosaveRef.current?.isPending()) { event.preventDefault(); event.returnValue = ""; }
    };
    if (Platform.OS === "web") {
      window.addEventListener("pagehide", flush);
      window.addEventListener("beforeunload", warn);
    }
    return () => {
      subscription?.remove();
      if (Platform.OS === "web") {
        window.removeEventListener("pagehide", flush);
        window.removeEventListener("beforeunload", warn);
      }
      // Guardar la sesión que esté activa al desmontar, no la del montaje.
      flush();
    };
  }, [autosaveRef]);
}
