import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef } from "react";
import { useCloudSync } from "./CloudSyncProvider";

// Actualiza una pantalla conservada en el Stack recién cuando vuelve a foco.
export function useSyncRefresh(refresh) {
  const revision = useCloudSync()?.status.dataRevision || 0;
  const previous = useRef(revision);
  useFocusEffect(useCallback(() => {
    if (previous.current === revision) return;
    previous.current = revision;
    refresh();
  }, [revision, refresh]));
}
export function useSyncHold(held) {
  const hold = useCloudSync()?.hold;
  useEffect(() => held && hold ? hold() : undefined, [held, hold]);
}
