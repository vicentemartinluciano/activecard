import { createHash } from "crypto";
import { createSyncRemote, splitText, validateManifest } from "../syncRemote";
import { emptyDocument } from "../syncDocument";
jest.mock("expo-crypto", () => ({ CryptoDigestAlgorithm: { SHA256: "SHA-256" } }));
const owner = "00000000-0000-4000-8000-000000000001";
const hash = async (text) => createHash("sha256").update(text).digest("hex");
const auth = { refresh_token: "REFRESH-PRIVADO", access_token: "ACCESS-PRIVADO", expires_in: 3600, user: { id: owner, email: "privado@example.test", email_confirmed_at: "2026-10-07T15:00:00Z", is_anonymous: false } };
const reply = (value, status = 200) => ({ status, ok: status >= 200 && status < 300, json: async () => value, text: async () => value });
function server() {
  const blobs = new Map(); let snapshot = null;
  const fetcher = jest.fn(async (url, options) => {
    if (url.includes("/auth/v1/token")) return reply(auth);
    if (url.endsWith("/activecard_access")) return reply(true);
    if (url.includes("/rest/v1/activecard_sync")) return reply(snapshot ? [snapshot] : []);
    if (url.endsWith("/activecard_commit")) {
      const body = JSON.parse(options.body);
      if (body.p_expected_revision !== (snapshot?.revision || 0)) return reply({ ok: false, revision: snapshot.revision });
      snapshot = { manifest: body.p_manifest, revision: (snapshot?.revision || 0) + 1 };
      return reply({ ok: true, revision: snapshot.revision });
    }
    const id = url.split("/").at(-1);
    if (options.method === "POST") {
      if (blobs.has(id)) return reply({}, 409);
      blobs.set(id, options.body); return reply({}, 200);
    }
    return blobs.has(id) ? reply(blobs.get(id)) : reply({}, 404);
  });
  const store = { readRefreshToken: jest.fn(async () => null), readRememberSession: jest.fn(async () => false), saveRefreshToken: jest.fn(async () => {}) };
  const remote = createSyncRemote({ fetcher, store, hash, uuid: () => "00000000-0000-4000-8000-000000000101" });
  return { remote, fetcher, store, blobs };
}
test("la contraseña viaja solo a Auth; se conserva únicamente el refresh token", async () => {
  const test = server(); await test.remote.login("privado@example.test", "CONTRASEÑA", false);
  expect(test.store.saveRefreshToken).toHaveBeenCalledWith("REFRESH-PRIVADO", false);
  expect(test.store.saveRefreshToken.mock.calls.flat().join()).not.toContain("CONTRASEÑA");
  expect(test.fetcher.mock.calls.filter(([, request]) => request.body?.includes("CONTRASEÑA"))).toHaveLength(1);
  await test.remote.logout();
  expect(test.store.saveRefreshToken).toHaveBeenLastCalledWith(null, false);
});
test("una cuenta sin permiso privado no deja un token guardado", async () => {
  const test = server(); test.fetcher.mockImplementationOnce(async () => reply(auth)).mockImplementationOnce(async () => reply(false));
  await expect(test.remote.login("correo", "contraseña")).rejects.toThrow("acceso privado");
  expect(test.store.saveRefreshToken).not.toHaveBeenCalled();
});
test("una respuesta tardía de login no vuelve a abrir una sesión cerrada", async () => {
  const test = server(); let complete;
  test.fetcher.mockImplementationOnce(() => new Promise((resolve) => { complete = resolve; }));
  const signing = test.remote.login("correo", "contraseña");
  await test.remote.logout(); complete(reply(auth));
  await expect(signing).rejects.toThrow("sesión cambió");
  expect(test.store.saveRefreshToken.mock.calls.some(([token]) => token === auth.refresh_token)).toBe(false);
});
test("dos clientes reconstruyen los mismos chats y adjuntos; los fragmentos se reutilizan", async () => {
  const test = server(); await test.remote.login("correo", "contraseña");
  const doc = emptyDocument();
  doc.gym_chats.chat = { title: "Fuentes", origin_card_id: null, draft_text: "", created_at: "2026-10-07T15:00:00Z", updated_at: "2026-10-07T15:00:00Z" };
  doc.gym_messages.message = { chat_id: "chat", role: "user", text: "Analizar", metadata: JSON.stringify({ sources: [{ name: "PDF", base64: "YWJj".repeat(100000) }] }), created_at: "2026-10-07T15:00:00Z" };
  expect(await test.remote.commit(doc, 0)).toEqual({ ok: true, revision: 1 });
  const count = test.blobs.size;
  await test.remote.commit(doc, 1);
  expect(test.blobs.size).toBe(count);
  const second = createSyncRemote({ fetcher: test.fetcher, store: test.store, hash });
  await second.login("correo", "contraseña");
  expect((await second.read()).document).toEqual(doc);
  const calls = test.fetcher.mock.calls.length;
  await second.read();
  expect(test.fetcher.mock.calls.length - calls).toBe(1);
});
test("un fragmento alterado se rechaza antes de devolver contenido a SQLite", async () => {
  const test = server(); await test.remote.login("correo", "contraseña");
  await test.remote.commit(emptyDocument(), 0);
  const key = [...test.blobs.keys()][0]; test.blobs.set(key, "CONTENIDO ALTERADO");
  const second = createSyncRemote({ fetcher: test.fetcher, store: test.store, hash });
  await second.login("correo", "contraseña");
  await expect(second.read()).rejects.toThrow("dañada");
});
test("un fallo de red no borra el token de sesión", async () => {
  const test = server(); test.store.readRefreshToken.mockResolvedValue(auth.refresh_token);
  test.fetcher.mockRejectedValueOnce(new TypeError("Network request failed"));
  await expect(test.remote.restore()).rejects.toThrow("Sin conexión");
  expect(test.store.saveRefreshToken).not.toHaveBeenCalled();
});
test("partir texto conserva emojis completos y rechaza rutas/manifiestos maliciosos", () => {
  const text = "a".repeat(256 * 1024 - 1) + "😀" + "resto";
  expect(splitText(text).join("")).toBe(text);
  expect(splitText(text)[0].endsWith("a")).toBe(true);
  expect(() => validateManifest({ schema: 1, entries: [["cards", "id", ["../../secreto"]]] })).toThrow();
  expect(() => validateManifest({ schema: 1, entries: [], settings: {} })).toThrow();
});
