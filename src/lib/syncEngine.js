import { emptyDocument, mergeDocuments, same } from "./syncDocument";
import * as localStorage from "./syncLocal";

export function createSyncEngine({ remote, local = localStorage, canApply = () => false, onStatus = () => {} }) {
  let user = null;
  let epoch = 0;
  let running = null;
  let maintenance = false;
  let restoring = null;
  let authenticating = false;
  let dataRevision = 0;
  const report = (status) => onStatus({ user, ...status });
  const check = (expected) => { if (expected !== epoch || !user) throw new Error("La sesión cambió."); };
  async function sync() {
    if (maintenance || authenticating) return;
    if (!user) return restore();
    if (running) return running;
    const expected = epoch;
    const owner = user.id;
    const stage = (message) => { if (expected === epoch) report({ message }); };
    const progress = (action) => (done, total) => stage(`${action}: ${done} de ${total} registros…`);
    running = (async () => {
      report({ busy: true, error: null, message: "Sincronizando…" });
      try {
        for (let attempt = 0; attempt < 4; attempt++) {
          stage("Leyendo los cambios de este dispositivo…");
          const captured = await local.readLocalSync(owner);
          stage("Consultando la cuenta…");
          const cloud = await remote.read(progress("Descargando"));
          check(expected);
          if (captured.clean && captured.checkpoint?.revision === cloud.revision) {
            report({ pending: false, syncedAt: new Date().toISOString(), message: "Al día" });
            return;
          }
          const merged = mergeDocuments(captured.checkpoint?.document || emptyDocument(), captured.document, cloud.document);
          if (!same(merged.document, captured.document)) {
            if (!canApply()) { report({ pending: true, message: "Hay cambios de otro dispositivo. Abrí Ajustes para incorporarlos sin interrumpir tu trabajo." }); return; }
            check(expected);
            stage("Guardando los cambios y la copia de recuperación…");
            if (!await local.applyLocalSync(owner, captured.document, merged.document, cloud.document, merged.conflicts, canApply)) continue;
            report({ dataRevision: ++dataRevision });
          }
          check(expected);
          if (!same(merged.document, cloud.document)) {
            const result = await remote.commit(merged.document, cloud.revision, progress("Subiendo"));
            check(expected);
            if (!result.ok) continue;
            stage("Guardando el estado de sincronización…");
            await local.saveCheckpoint(owner, merged.document, result.revision);
          } else {
            stage("Guardando el estado de sincronización…");
            await local.saveCheckpoint(owner, merged.document, cloud.revision);
          }
          check(expected);
          report({ pending: false, syncedAt: new Date().toISOString(), message: merged.conflicts.length ? "Sincronizado. Las alternativas locales quedaron en Recuperación." : "Al día" });
          return;
        }
        throw new Error("Hubo cambios simultáneos. Reintentaremos sin sobrescribirlos.");
      } catch (error) {
        if (expected === epoch) report({ error: error.message, message: error.message });
      } finally {
        if (expected === epoch) report({ busy: false });
        running = null;
      }
    })();
    return running;
  }
  async function restore() {
    if (authenticating) return;
    if (restoring) return restoring;
    const expected = epoch;
    restoring = (async () => {
      try {
        const account = await remote.restore();
        if (expected !== epoch || !account) return;
        await local.readLocalSync(account.id);
        if (expected !== epoch) return;
        user = account; report({ error: null, message: "Cuenta conectada" });
        await sync();
      } catch (error) { if (expected === epoch) report({ error: error.message, message: error.message }); }
    })();
    try { return await restoring; }
    finally { restoring = null; }
  }
  return {
    sync,
    restore,
    async restoreCopy(id) {
      if (!user || maintenance) return;
      maintenance = true;
      try {
        if (running) await running;
        await local.restoreRecovery(user.id, id);
        report({ dataRevision: ++dataRevision });
      } finally { maintenance = false; }
      await sync();
    },
    async login(email, password, remember) {
      if (running) await running;
      const expected = ++epoch;
      authenticating = true;
      try {
        const account = await remote.login(email, password, remember);
        if (expected !== epoch) return;
        await local.readLocalSync(account.id);
        if (expected !== epoch) return;
        user = account; report({ error: null, message: "Cuenta conectada" });
      } finally { authenticating = false; }
      await sync();
    },
    async logout() {
      // Esperar el ciclo evita cerrar sesión en medio de una transacción local.
      if (running) await running;
      epoch++; await remote.logout(); user = null;
      report({ busy: false, error: null, pending: false, syncedAt: null, message: "Tus datos siguen en este dispositivo" });
    },
  };
}
