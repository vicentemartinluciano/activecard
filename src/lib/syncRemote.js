import * as Crypto from "expo-crypto";
import { canonical, COLUMNS, emptyDocument, validateDocument } from "./syncDocument";
import * as sessionStore from "./syncSession";

// Configuración pública. Nunca se usa una service_role ni una clave de REANCLA.
export const SYNC_URL = "https://grhgrlaltuolzlorgaeg.supabase.co";
const PUBLIC_KEY = "sb_publishable_Z-QfsMW0V9DU6okYwWW4lQ_g-LTJCsD";
const BUCKET = "activecard-private";
const CHUNK = 256 * 1024;
const MAX_DOCUMENT = 256 * 1024 * 1024;
const hashText = (text) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text);
// Cuatro filas a la vez evitan cientos de viajes consecutivos sin cargar toda
// la biblioteca en memoria. Si una falla, esperamos las que ya están en vuelo.
async function transfer(rows, task, progress) {
  let next = 0;
  let completed = 0;
  let failure;
  progress(0, rows.length);
  await Promise.all(Array.from({ length: Math.min(4, rows.length) }, async () => {
    while (!failure && next < rows.length) {
      const index = next++;
      try {
        await task(rows[index], index);
        progress(++completed, rows.length);
      } catch (error) { failure ||= error; }
    }
  }));
  if (failure) throw failure;
}
export function splitText(text) {
  const chunks = [];
  for (let offset = 0; offset < text.length;) {
    let end = Math.min(offset + CHUNK, text.length);
    const code = text.charCodeAt(end - 1);
    if (end < text.length && code >= 0xd800 && code <= 0xdbff) end--;
    chunks.push(text.slice(offset, end));
    offset = end;
  }
  return chunks;
}
export function validateManifest(manifest) {
  if (!manifest || manifest.schema !== 1 || Object.keys(manifest).sort().join() !== "entries,schema" || !Array.isArray(manifest.entries) || manifest.entries.length > 100000 || canonical(manifest).length > 1800000) throw new Error("El índice de sincronización no es válido.");
  const seen = new Set();
  for (const entry of manifest.entries) {
    if (!Array.isArray(entry) || entry.length !== 3) throw new Error("Índice incompleto.");
    const [table, id, hashes] = entry;
    const key = canonical([table, id]);
    if (!(Object.hasOwn(COLUMNS, table) || table === "deck_tags") || typeof id !== "string" || !id || id.length > 512 || seen.has(key) || !Array.isArray(hashes) || !hashes.length || hashes.length > 1024 || hashes.some((hash) => typeof hash !== "string" || !/^[a-f0-9]{64}$/.test(hash))) throw new Error("Índice incompleto.");
    if (table === "deck_tags" && id !== "links") throw new Error("Índice incompleto.");
    seen.add(key);
  }
  return manifest;
}
export function createSyncRemote({ fetcher = fetch, store = sessionStore, hash = hashText, uuid = () => Crypto.randomUUID() } = {}) {
  let session = null;
  let generation = 0;
  let remember = false;
  let refreshing = null;
  let storageTail = Promise.resolve();
  const cachedBlobs = new Map();
  const knownBlobs = new Set();
  const downloads = new Map();
  const uploads = new Map();
  let lastCloud = null;
  let confirmedBase = null;
  const persist = (token, epoch) => {
    const result = storageTail.then(() => epoch === generation ? store.saveRefreshToken(token, remember) : undefined);
    storageTail = result.catch(() => {});
    return result;
  };
  async function request(path, { body, method = "GET", access = null, text = false, existing = false } = {}) {
    const controller = new AbortController();
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error("La cuenta tardó demasiado en responder. Tus datos siguen guardados; podés reintentar."));
      }, 25000);
    });
    try {
      return await Promise.race([timeout, (async () => {
        const response = await fetcher(`${SYNC_URL}${path}`, {
          method, signal: controller.signal,
          headers: { apikey: PUBLIC_KEY, ...(access ? { Authorization: `Bearer ${access}` } : {}), ...(body !== undefined ? { "Content-Type": text ? "text/plain; charset=utf-8" : "application/json" } : {}) },
          ...(body !== undefined ? { body: text ? body : JSON.stringify(body) } : {}),
        });
        if (existing && [400, 409].includes(response.status)) {
          // Storage también devuelve duplicados como HTTP 400 (API legacy).
          // Solo reutilizamos ese archivo después de descargarlo y verificar SHA-256.
          let failure;
          try { failure = await response.json(); } catch { failure = null; }
          if (response.status === 409 || failure?.error === "Duplicate" || ["ResourceAlreadyExists", "KeyAlreadyExists"].includes(failure?.code) || failure?.message === "Asset Already Exists") return null;
        }
        if (!response.ok) {
          if (response.status === 404) throw new Error("Falta habilitar la sincronización de ActiveCard en Supabase.");
          if ([400, 401].includes(response.status) && path.startsWith("/auth/")) throw new Error("No pudimos iniciar sesión. Revisá tu correo y contraseña de REANCLA.");
          if ([401, 403].includes(response.status)) throw new Error("La sesión no tiene acceso a la cuenta privada de ActiveCard.");
          if ([413, 507].includes(response.status)) throw new Error("El almacenamiento está lleno o este contenido supera su límite. Tus cambios siguen guardados en este dispositivo.");
          throw new Error("No pudimos completar la sincronización. Los cambios locales siguen guardados.");
        }
        return text ? await response.text() : await response.json();
      })()]);
    } catch (error) {
      if (error.name === "AbortError" || error instanceof TypeError) throw new Error("Sin conexión con la cuenta. Podés seguir usando ActiveCard; reintentaremos la sincronización.");
      throw error;
    } finally { clearTimeout(timer); }
  }
  async function accept(data, epoch) {
    if (!data?.refresh_token || !data?.access_token || !data.user?.id || !data.user.email_confirmed_at || data.user.is_anonymous) throw new Error("Usá tu cuenta privada confirmada de REANCLA.");
    const allowed = await request("/rest/v1/rpc/activecard_access", { method: "POST", body: {}, access: data.access_token });
    if (allowed !== true) throw new Error("Esta cuenta no tiene habilitado el acceso privado a ActiveCard.");
    if (epoch !== generation) throw new Error("La sesión cambió. Volvé a conectar la cuenta.");
    await persist(data.refresh_token, epoch);
    if (epoch !== generation) throw new Error("La sesión cambió.");
    session = { ...data, expires: Date.now() + Math.max(0, Number(data.expires_in || 3600)) * 1000 };
    return { id: data.user.id, email: data.user.email };
  }
  async function refresh(token) {
    if (refreshing) return refreshing;
    const epoch = generation;
    refreshing = request("/auth/v1/token?grant_type=refresh_token", { method: "POST", body: { refresh_token: token } }).then((data) => accept(data, epoch)).finally(() => { refreshing = null; });
    return refreshing;
  }
  async function credentials() {
    if (!session) throw new Error("Conectá tu cuenta para sincronizar.");
    if (session.expires <= Date.now() + 60000) await refresh(session.refresh_token);
    if (!session) throw new Error("La sesión se cerró.");
    return { access: session.access_token, owner: session.user.id, epoch: generation };
  }
  const check = (epoch) => { if (epoch !== generation || !session) throw new Error("La sesión se cerró."); };
  async function getBlob(id, auth) {
    if (cachedBlobs.has(id)) return cachedBlobs.get(id);
    if (downloads.has(id)) return downloads.get(id);
    const pending = (async () => {
      const text = await request(`/storage/v1/object/authenticated/${BUCKET}/${auth.owner}/${id}`, { access: auth.access, text: true });
      check(auth.epoch);
      if (text.length > CHUNK || await hash(text) !== id) throw new Error("Una parte del contenido está dañada. No se modificaron los datos locales.");
      knownBlobs.add(id);
      // Cache acotada; las imágenes grandes no quedan duplicadas indefinidamente.
      if (cachedBlobs.size < 128) cachedBlobs.set(id, text);
      return text;
    })();
    downloads.set(id, pending);
    try { return await pending; }
    finally { downloads.delete(id); }
  }
  async function putBlob(digest, part, auth) {
    if (knownBlobs.has(digest)) return;
    if (uploads.has(digest)) return uploads.get(digest);
    const pending = (async () => {
      const uploaded = await request(`/storage/v1/object/${BUCKET}/${auth.owner}/${digest}`, { method: "POST", body: part, text: true, access: auth.access, existing: true });
      if (uploaded === null) await getBlob(digest, auth);
      check(auth.epoch);
      knownBlobs.add(digest);
      if (cachedBlobs.size < 128) cachedBlobs.set(digest, part);
    })();
    uploads.set(digest, pending);
    try { return await pending; }
    finally { uploads.delete(digest); }
  }
  return {
    async login(email, password, keepSession = false) {
      const epoch = ++generation;
      session = null; cachedBlobs.clear(); knownBlobs.clear(); lastCloud = null; confirmedBase = null; remember = keepSession;
      const data = await request("/auth/v1/token?grant_type=password", { method: "POST", body: { email: email.trim(), password } });
      return accept(data, epoch);
    },
    async restore() {
      remember = await store.readRememberSession();
      const token = await store.readRefreshToken();
      return token ? refresh(token) : null;
    },
    async logout() { const epoch = ++generation; session = null; cachedBlobs.clear(); knownBlobs.clear(); lastCloud = null; confirmedBase = null; await persist(null, epoch); },
    async read(progress = () => {}, checkpoint = null) {
      const auth = await credentials();
      // El checkpoint vive en SQLite, no en la caché de esta pestaña. Consultar
      // primero la revisión evita volver a descargarlo al reiniciar el navegador.
      let known = lastCloud?.owner === auth.owner ? lastCloud : null;
      if (checkpoint?.owner === auth.owner) {
        if (!Number.isSafeInteger(checkpoint.revision) || checkpoint.revision < 0) throw new Error("Revisión local inválida.");
        const document = validateDocument(checkpoint.document);
        if (!known || checkpoint.revision >= known.revision) known = { ...checkpoint, document };
      }
      const validateRevision = (rows) => {
        if (!Array.isArray(rows) || rows.length > 1) throw new Error("Respuesta de sincronización inválida.");
        const revision = rows.length ? rows[0].revision : 0;
        if (!Number.isSafeInteger(revision) || revision < 0) throw new Error("Revisión inválida.");
        if (known && revision < known.revision) throw new Error("La nube perdió una versión confirmada. Tus datos locales siguen guardados.");
        return revision;
      };
      if (known) {
        const metadata = await request("/rest/v1/activecard_sync?select=revision", { access: auth.access });
        check(auth.epoch);
        const revision = validateRevision(metadata);
        if (revision === known.revision) {
          confirmedBase = { owner: auth.owner, revision, document: known.document };
          return { revision, document: known.document };
        }
      }
      const rows = await request("/rest/v1/activecard_sync?select=revision,manifest", { access: auth.access });
      check(auth.epoch);
      const revision = validateRevision(rows);
      if (!rows.length) return { revision: 0, document: emptyDocument() };
      const { manifest } = rows[0];
      validateManifest(manifest);
      const document = emptyDocument();
      let total = 0;
      const installRow = (table, id, row, length) => {
        total += length;
        if (total > MAX_DOCUMENT) throw new Error("El contenido excede el límite de sincronización.");
        if (table === "deck_tags") document.deck_tags = row;
        else Object.defineProperty(document[table], id, { value: row, enumerable: true, configurable: true, writable: true });
      };
      const missing = new Set();
      // Una versión nueva puede cambiar una sola tarjeta. Reutilizamos cada fila
      // del checkpoint únicamente si sus fragmentos coinciden con el manifiesto.
      await transfer(manifest.entries, async ([table, id, hashes], index) => {
        const row = table === "deck_tags" ? known?.document.deck_tags : known?.document[table][id];
        if (row !== undefined) {
          const text = canonical(row);
          const parts = splitText(text);
          if (parts.length === hashes.length) {
            const digests = await Promise.all(parts.map(hash));
            check(auth.epoch);
            if (digests.every((digest, part) => digest === hashes[part])) {
              hashes.forEach((digest) => knownBlobs.add(digest));
              installRow(table, id, row, text.length);
              return;
            }
          }
        }
        missing.add(index);
      }, () => {});
      const changedRows = manifest.entries.filter((_, index) => missing.has(index));
      if (changedRows.length) await transfer(changedRows, async ([table, id, hashes]) => {
        let serialized = "";
        for (const part of hashes) { serialized += await getBlob(part, auth);  }
        installRow(table, id, JSON.parse(serialized), serialized.length);
      }, progress);
      check(auth.epoch);
      validateDocument(document);
      lastCloud = { owner: auth.owner, revision, manifest, document };
      confirmedBase = { owner: auth.owner, revision, document };
      return { revision, document };
    },
    async commit(document, revision, progress = () => {}) {
      validateDocument(document);
      const auth = await credentials();
      const entries = [];
      let total = 0;
      const records = [];
      for (const table of [...Object.keys(COLUMNS), "deck_tags"]) {
        const rows = table === "deck_tags" ? [["links", document.deck_tags]] : Object.entries(document[table]).sort(([a], [b]) => a.localeCompare(b));
        for (const [id, row] of rows) records.push([table, id, row]);
      }
      await transfer(records, async ([table, id, row], index) => {
        const text = canonical(row);
        const previous = table === "deck_tags" ? confirmedBase?.document.deck_tags : confirmedBase?.document[table][id];
        const unchanged = confirmedBase?.owner === auth.owner && confirmedBase.revision === revision && previous !== undefined && canonical(previous) === text;
        total += text.length;
        if (total > MAX_DOCUMENT) throw new Error("El contenido excede el límite de sincronización. Todo sigue guardado localmente.");
        const hashes = [];
        for (const part of splitText(text)) {
          const digest = await hash(part);
          check(auth.epoch);
          hashes.push(digest);
          if (unchanged) knownBlobs.add(digest);
          await putBlob(digest, part, auth);
        }
        entries[index] = [table, id, hashes];
      }, progress);
      const manifest = validateManifest({ schema: 1, entries });
      const result = await request("/rest/v1/rpc/activecard_commit", { method: "POST", body: { p_manifest: manifest, p_expected_revision: revision, p_change_id: uuid() }, access: auth.access });
      check(auth.epoch);
      if (typeof result?.ok !== "boolean" || !Number.isSafeInteger(result.revision) || result.revision < revision) throw new Error("Respuesta de sincronización inválida.");
      if (result.ok) {
        lastCloud = { owner: auth.owner, revision: result.revision, manifest, document };
        confirmedBase = { owner: auth.owner, revision: result.revision, document };
      }
      return result;
    },
  };
}
