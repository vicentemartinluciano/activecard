import { createSyncEngine } from "../syncEngine";
import { emptyDocument } from "../syncDocument";

const doc = (name) => ({ ...emptyDocument(), folders: { folder: { name, created_at: "2026-10-07T15:00:00Z" } } });
function setup({ safe = true, localDoc = doc("PC"), remoteDoc = doc("Android"), base = doc("Inicial") } = {}) {
  const events = [];
  let captured = localDoc;
  const local = {
    readLocalSync: jest.fn(async () => ({ document: captured, checkpoint: { document: base } })),
    applyLocalSync: jest.fn(async (owner, expected, merged) => { events.push("archive+apply"); captured = merged; return true; }),
    saveCheckpoint: jest.fn(async () => events.push("checkpoint")),
  };
  const remote = { login: jest.fn(async () => ({ id: "owner", email: "privado@example.test" })), read: jest.fn(async () => ({ document: remoteDoc, revision: 1 })), commit: jest.fn(async () => { events.push("commit"); return { ok: true, revision: 2 }; }), logout: jest.fn() };
  const statuses = [];
  const engine = createSyncEngine({ remote, local, canApply: () => safe, onStatus: (value) => statuses.push(value) });
  return { engine, local, remote, events, statuses };
}
test("archiva/aplica antes de avanzar el checkpoint de un conflicto", async () => {
  const test = setup(); await test.engine.login("correo", "contraseña");
  expect(test.events).toEqual(["archive+apply", "checkpoint"]);
  expect(test.local.applyLocalSync.mock.calls[0][4]).toHaveLength(1);
});
test("aplaza cambios remotos mientras el usuario edita o estudia", async () => {
  const test = setup({ safe: false }); await test.engine.login("correo", "contraseña");
  expect(test.local.applyLocalSync).not.toHaveBeenCalled();
  expect(test.remote.commit).not.toHaveBeenCalled();
  expect(test.statuses.some((status) => status.pending)).toBe(true);
});
test("puede subir cambios locales sin incorporar cambios remotos durante el estudio", async () => {
  const test = setup({ safe: false, remoteDoc: doc("Inicial") }); await test.engine.login("correo", "contraseña");
  expect(test.events).toEqual(["commit", "checkpoint"]);
});
test("reintenta cuando aparece una edición entre la captura y la instalación", async () => {
  const test = setup(); test.local.applyLocalSync.mockResolvedValueOnce(false);
  await test.engine.login("correo", "contraseña");
  expect(test.local.applyLocalSync).toHaveBeenCalledTimes(2);
  expect(test.local.saveCheckpoint).toHaveBeenCalledTimes(1);
});
test("un fallo de archivado impide publicar y avanzar el checkpoint", async () => {
  const test = setup(); test.local.applyLocalSync.mockRejectedValue(new Error("No hay espacio para conservar la copia"));
  await test.engine.login("correo", "contraseña");
  expect(test.remote.commit).not.toHaveBeenCalled();
  expect(test.local.saveCheckpoint).not.toHaveBeenCalled();
  expect(test.statuses.some((status) => status.error)).toBe(true);
});
test("una revisión vieja nunca se trata como una escritura exitosa", async () => {
  const test = setup({ remoteDoc: doc("Inicial") }); test.remote.commit.mockResolvedValue({ ok: false, revision: 2 });
  await test.engine.login("correo", "contraseña");
  expect(test.remote.commit).toHaveBeenCalledTimes(4);
  expect(test.local.saveCheckpoint).not.toHaveBeenCalled();
});

test("reconecta automáticamente una sesión que arrancó sin conexión", async () => {
  const test = setup({ localDoc: doc("Inicial"), remoteDoc: doc("Inicial") });
  test.remote.restore = jest.fn().mockRejectedValueOnce(new Error("Sin conexión")).mockResolvedValue({ id: "owner", email: "privado@example.test" });
  await test.engine.restore();
  expect(test.remote.read).not.toHaveBeenCalled();
  await test.engine.sync();
  expect(test.remote.restore).toHaveBeenCalledTimes(2);
  expect(test.remote.read).toHaveBeenCalledTimes(1);
  expect(test.statuses.at(-1).user.id).toBe("owner");
  expect(test.statuses.some((status) => status.message === "Al día")).toBe(true);
});
