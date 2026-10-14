// Agrupa escrituras (review + log, imports, sync) y vuelve a leer si hubo
// cambios durante un render. Nunca deja un snapshot anterior como último render.
export function createWidgetRefreshScheduler(refresh, onError) {
  let timer = null;
  let running = false;
  let dirty = false;
  let disposed = false;
  async function flush() {
    if (disposed) return;
    clearTimeout(timer);
    timer = null;
    dirty = true;
    if (running) return;
    running = true;
    try {
      while (dirty && !disposed) {
        dirty = false;
        try { await refresh(); } catch (error) { onError(error); }
      }
    } finally { running = false; }
  }
  return {
    request() {
      if (disposed) return;
      dirty = true;
      if (running) return;
      clearTimeout(timer);
      timer = setTimeout(flush, 300);
    },
    flush,
    dispose() { disposed = true; dirty = false; clearTimeout(timer); },
  };
}
