import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { createRequire } from "node:module";
import { build } from "esbuild";
const require = createRequire(import.meta.url);
const Module = require("node:module");
const compiled = await build({
  stdin: { contents: `export { migrate, MIGRATIONS } from './src/db/schema'; export { manageDatabase, withDbTransaction } from './src/db/transactions'; export { reviewCard } from './src/db/cards'; export { listGymChats } from './src/db/gymChats'; export { buildBackup, restoreBackup } from './src/lib/backup'; export * from './src/lib/syncLocal'; export * from './src/lib/syncDocument';`, resolveDir: process.cwd() },
  bundle: true, write: false, platform: "node", format: "cjs",
  plugins: [{ name: "test-connection", setup(builder) {
    builder.onResolve({ filter: /(?:^|\/)client$/ }, () => ({ path: "connection", namespace: "test" }));
    builder.onLoad({ filter: /.*/, namespace: "test" }, () => ({ contents: "export const getDb = async () => globalThis.activecardTestDb;" }));
  } }],
});
const module = new Module("activecard-sync-test");
module._compile(compiled.outputFiles[0].text, "activecard-sync-test.cjs");
const api = module.exports;
const sqlite = new DatabaseSync(":memory:");
const raw = {
  execAsync: async (sql) => sqlite.exec(sql),
  runAsync: async (sql, params = []) => { const result = sqlite.prepare(sql).run(...params); return { ...result, lastInsertRowId: Number(result.lastInsertRowid) }; },
  getAllAsync: async (sql, params = []) => sqlite.prepare(sql).all(...params),
  getFirstAsync: async (sql, params = []) => sqlite.prepare(sql).get(...params),
};
globalThis.activecardTestDb = api.manageDatabase(raw);
const owner = "private-owner";
const now = "2026-10-07T15:00:00.000Z";
try {
  await raw.execAsync("PRAGMA foreign_keys = ON");
  // Emular un teléfono v7 con datos anteriores a la identidad entre dispositivos.
  for (const migration of api.MIGRATIONS.slice(0, 7)) await raw.execAsync(migration);
  await raw.execAsync("PRAGMA user_version = 7");
  await raw.runAsync("INSERT INTO folders(id,name,created_at) VALUES(1,'Facultad',?)", [now]);
  await raw.runAsync("INSERT INTO decks(id,name,created_at,folder_id) VALUES(1,'Mazo',?,1)", [now]);
  await raw.runAsync("INSERT INTO cards(id,deck_id,front,back,created_at,due) VALUES(1,1,'Pregunta','Respuesta',?,?)", [now, now]);
  await raw.runAsync("INSERT INTO settings(key,value) VALUES('openAIKey','NO-DEBE-SINCRONIZARSE')");
  await api.migrate(raw);
  const first = await api.readLocalSync(owner);
  assert.equal(first.document.cards[`legacy:cards:1:${now}`].front, "Pregunta");
  assert.equal(JSON.stringify(first.document).includes("NO-DEBE"), false);
  await globalThis.activecardTestDb.runAsync("INSERT INTO folders(name,created_at) VALUES('Nueva',?)", [now]);
  const identity = await raw.getFirstAsync("SELECT sync_id FROM folders WHERE id=2");
  assert.match(identity.sync_id, /^[a-f0-9]{32}$/);
  const local = await api.readLocalSync(owner);
  const cloud = structuredClone(local.document);
  const cardKey = Object.keys(cloud.cards)[0];
  cloud.cards[cardKey].front = "Pregunta desde Android";
  cloud.gym_chats.chat = { title: "Charla", draft_text: "Borrador", origin_card_id: cardKey, created_at: now, updated_at: now };
  cloud.gym_messages.message = { chat_id: "chat", role: "user", text: "Fuente", created_at: now, metadata: JSON.stringify({ attachments: [{ cardId: cardKey, deckId: Object.keys(cloud.decks)[0] }], sources: [{ name: "PDF", base64: "YWJj" }] }) };
  assert.equal(await api.applyLocalSync(owner, local.document, cloud, cloud, [], () => false), false);
  let safeChecks = 0;
  assert.equal(await api.applyLocalSync(owner, local.document, cloud, cloud, [], () => ++safeChecks === 1), false);
  assert.equal((await raw.getFirstAsync("SELECT front FROM cards WHERE id=1")).front, "Pregunta");
  assert.equal((await api.listRecoveries(owner)).length, 0);
  assert.equal(await api.applyLocalSync(owner, local.document, cloud, cloud, []), true);
  const card = await raw.getFirstAsync("SELECT * FROM cards WHERE id=1");
  assert.equal(card.front, "Pregunta desde Android");
  const message = await raw.getFirstAsync("SELECT metadata FROM gym_messages");
  assert.equal(JSON.parse(message.metadata).attachments[0].cardId, 1);
  assert.equal(JSON.parse(message.metadata).sources[0].base64, "YWJj");
  assert.equal((await raw.getFirstAsync("SELECT value FROM settings WHERE key='openAIKey'")).value, "NO-DEBE-SINCRONIZARSE");
  const after = await api.readLocalSync(owner);
  assert.deepEqual(after.document, cloud);
  assert.equal(await api.applyLocalSync(owner, local.document, cloud, cloud, []), false);
  await api.saveCheckpoint(owner, cloud, 1);
  await assert.rejects(() => api.readLocalSync("another-owner"), /otra cuenta/);
  const copies = await api.listRecoveries(owner);
  assert.equal(copies.length, 1);
  await api.restoreRecovery(owner, copies[0].id);
  assert.equal((await raw.getFirstAsync("SELECT front FROM cards WHERE id=1")).front, "Pregunta");
  assert.equal((await api.listRecoveries(owner)).length, 2);
  const backup = await api.buildBackup(raw);
  await api.restoreBackup(globalThis.activecardTestDb, backup);
  assert.deepEqual((await api.readLocalSync(owner)).document, api.documentFromBackup(backup));
  const beforeReview = await raw.getFirstAsync("SELECT * FROM cards WHERE id=1");
  await raw.execAsync("CREATE TRIGGER fail_review BEFORE INSERT ON review_logs BEGIN SELECT RAISE(ABORT, 'fallo de registro'); END;");
  await assert.rejects(() => api.reviewCard(beforeReview, "hard", "daily", new Date(now)), /fallo de registro/);
  assert.deepEqual(await raw.getFirstAsync("SELECT * FROM cards WHERE id=1"), beforeReview);
  assert.equal((await raw.getFirstAsync("SELECT COUNT(*) AS n FROM review_logs")).n, 0);
  await raw.execAsync("DROP TRIGGER fail_review;");
  await raw.runAsync("INSERT INTO gym_chats(id,title,created_at,updated_at) VALUES(1,'Historial',?,?)", [now, now]);
  await raw.runAsync("INSERT INTO gym_messages(id,chat_id,role,text,created_at) VALUES(2,1,'user','Anterior',?)", [now]);
  await raw.runAsync("INSERT INTO gym_messages(id,chat_id,role,text,created_at) VALUES(1,1,'assistant','Más reciente',?)", ["2026-10-07T16:00:00.000Z"]);
  assert.equal((await api.listGymChats())[0].last_message, "Más reciente");
  console.log("OK: migración v7→v8, identidades, aislamiento de claves, relaciones, adjuntos, recuperación y respaldo v4 verificados en SQLite real.");
} finally { sqlite.close(); delete globalThis.activecardTestDb; }
