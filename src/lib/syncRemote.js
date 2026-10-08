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
  let lastCloud = null;
  const persist = (token, epoch) => {
    const result = storageTail.then(() => epoch === generation ? store.saveRefreshToken(token, remember) : undefined);
    storageTail = result.catch(() => {});
    return result;
  };
  async function request(path, { body, method = "GET", access = null, text = false, existing = false } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    let response;
    try {
      response = await fetcher(`${SYNC_URL}${path}`, {
        method, signal: controller.signal,
        headers: { apikey: PUBLIC_KEY, ...(access ? { Authorization: `Bearer ${access}` } : {}), ...(body !== undefined ? { "Content-Type": text ? "text/plain; charset=utf-8" : "application/json" } : {}) },
        ...(body !== undefined ? { body: text ? body : JSON.stringify(body) } : {}),
      });
      if (existing && response.status === 409) return null;
      if (!response.ok) {
        if (response.status === 404) throw new Error("Falta habilitar la sincronización de ActiveCard en Supabase.");
        if ([400, 401].includes(response.status) && path.startsWith("/auth/")) throw new Error("No pudimos iniciar sesión. Revisá tu correo y contraseña de REANCLA.");
        if ([401, 403].includes(response.status)) throw new Error("La sesión no tiene acceso a la cuenta privada de ActiveCard.");
        if ([413, 507].includes(response.status)) throw new Error("El almacenamiento está lleno o este contenido supera su límite. Tus cambios siguen guardados en este dispositivo.");
        throw new Error("No pudimos completar la sincronización. Los cambios locales siguen guardados.");
      }
      return text ? await response.text() : await response.json();
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
    const text = await request(`/storage/v1/object/authenticated/${BUCKET}/${auth.owner}/${id}`, { access: auth.access, text: true });
    check(auth.epoch);
    if (text.length > CHUNK || await hash(text) !== id) throw new Error("Una parte del contenido está dañada. No se modificaron los datos locales.");
    knownBlobs.add(id);
    // Cache acotada; las imágenes grandes no quedan duplicadas indefinidamente.
    if (cachedBlobs.size < 128) cachedBlobs.set(id, text);
    return text;
  }
  return {
    async login(email, password, keepSession = false) {
      const epoch = ++generation;
      session = null; cachedBlobs.clear(); knownBlobs.clear(); lastCloud = null; remember = keepSession;
      const data = await request("/auth/v1/token?grant_type=password", { method: "POST", body: { email: email.trim(), password } });
      return accept(data, epoch);
    },
    async restore() {
      remember = await store.readRememberSession();
      const token = await store.readRefreshToken();
      return token ? refresh(token) : null;
    },
    async logout() { const epoch = ++generation; session = null; cachedBlobs.clear(); knownBlobs.clear(); lastCloud = null; await persist(null, epoch); },
    async read() {
      const auth = await credentials();
      const rows = await request("/rest/v1/activecard_sync?select=revision,manifest", { access: auth.access });
      check(auth.epoch);
      if (!Array.isArray(rows) || rows.length > 1) throw new Error("Respuesta de sincronización inválida.");
      if (!rows.length) return { revision: 0, document: emptyDocument() };
      const { revision, manifest } = rows[0];
      if (!Number.isSafeInteger(revision) || revision < 0) throw new Error("Revisión inválida.");
      validateManifest(manifest);
      if (lastCloud?.owner === auth.owner && lastCloud.revision === revision && canonical(lastCloud.manifest) === canonical(manifest)) return { revision, document: lastCloud.document };
      const document = emptyDocument();
      let total = 0;
      for (const [table, id, hashes] of manifest.entries) {
        let serialized = "";
        for (const part of hashes) { serialized += await getBlob(part, auth);  }
        total += serialized.length;
        if (total > MAX_DOCUMENT) throw new Error("El contenido excede el límite de sincronización.");
        const row = JSON.parse(serialized);
        if (table === "deck_tags") document.deck_tags = row;
        else Object.defineProperty(document[table], id, { value: row, enumerable: true, configurable: true, writable: true });
      }
      validateDocument(document);
      lastCloud = { owner: auth.owner, revision, manifest, document };
      return { revision, document };
    },
    async commit(document, revision) {
      validateDocument(document);
      const auth = await credentials();
      const entries = [];
      let total = 0;
      for (const table of [...Object.keys(COLUMNS), "deck_tags"]) {
        const rows = table === "deck_tags" ? [["links", document.deck_tags]] : Object.entries(document[table]).sort(([a], [b]) => a.localeCompare(b));
        for (const [id, row] of rows) {
          const text = canonical(row);
          total += text.length;
          if (total > MAX_DOCUMENT) throw new Error("El contenido excede el límite de sincronización. Todo sigue guardado localmente.");
          const hashes = [];
          for (const part of splitText(text)) {
            const digest = await hash(part);
            hashes.push(digest);
            if (!knownBlobs.has(digest)) {
              await request(`/storage/v1/object/${BUCKET}/${auth.owner}/${digest}`, { method: "POST", body: part, text: true, access: auth.access, existing: true });
              check(auth.epoch);
              knownBlobs.add(digest);
              if (cachedBlobs.size < 128) cachedBlobs.set(digest, part);
            }
          }
          entries.push([table, id, hashes]);
        }
      }
      const manifest = validateManifest({ schema: 1, entries });
      const result = await request("/rest/v1/rpc/activecard_commit", { method: "POST", body: { p_manifest: manifest, p_expected_revision: revision, p_change_id: uuid() }, access: auth.access });
      check(auth.epoch);
      if (typeof result?.ok !== "boolean" || !Number.isSafeInteger(result.revision) || result.revision < revision) throw new Error("Respuesta de sincronización inválida.");
      if (result.ok) lastCloud = { owner: auth.owner, revision: result.revision, manifest, document };
      return result;
    },
  };
}
