import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { createRequire } from "node:module";
import { build } from "esbuild";
const require = createRequire(import.meta.url);
const Module = require("node:module");
const compiled = await build({
  stdin: { contents: `export { migrate } from './src/db/schema'; export { manageDatabase } from './src/db/transactions'; export * from './src/db/folders'; export { createDeck } from './src/db/decks'; export { createCard, reviewCard, getCard } from './src/db/cards'; export * from './src/lib/backup'; export * from './src/lib/backupMerge'; export * from './src/lib/deckExport'; export * from './src/lib/syncDocument'; export * from './src/lib/syncLocal';`, resolveDir: process.cwd() },
  bundle: true, write: false, platform: "node", format: "cjs",
  plugins: [{ name: "test-connection", setup(builder) {
    builder.onResolve({ filter: /(?:^|\/)client$/ }, () => ({ path: "connection", namespace: "test" }));
    builder.onLoad({ filter: /.*/, namespace: "test" }, () => ({ contents: "export const getDb = async () => globalThis.activecardLibraryTestDb;" }));
  } }],
});
const module = new Module("activecard-library-test");
module._compile(compiled.outputFiles[0].text, "activecard-library-test.cjs");
const api = module.exports;
const sqlite = new DatabaseSync(":memory:");
const raw = {
  execAsync: async (sql) => sqlite.exec(sql),
  runAsync: async (sql, params = []) => { const r = sqlite.prepare(sql).run(...params); return { ...r, lastInsertRowId: Number(r.lastInsertRowid) }; },
  getAllAsync: async (sql, params = []) => sqlite.prepare(sql).all(...params),
  getFirstAsync: async (sql, params = []) => sqlite.prepare(sql).get(...params),
};
const db = api.manageDatabase(raw);
globalThis.activecardLibraryTestDb = db;
try {
  await raw.execAsync("PRAGMA foreign_keys = ON");
  await api.migrate(raw);
  const root = await api.createFolder("Facultad");
  const child = await api.createFolder("Marketing", root);
  const leaf = await api.createFolder("Unidad 1", child);
  await assert.rejects(() => api.moveFolder(root, leaf), /subcarpeta/);
  await assert.rejects(() => api.moveFolder(root, 999), /subcarpeta/);
  const deck = await api.createDeck("Conceptos");
  await db.runAsync("UPDATE decks SET folder_id = ? WHERE id = ?", [leaf, deck]);
  const card = await api.createCard({ deckId: deck, front: "Pregunta", back: "Respuesta" });
  await api.reviewCard(await api.getCard(card), "good", "daily", new Date("2026-10-16T12:00:00Z"));
  await raw.runAsync("INSERT INTO settings(key,value) VALUES('privateKey','NO-COMPARTIR')");
  const backup = await api.buildBackup(db);
  await api.restoreBackup(db, backup);
  assert.equal((await api.getFolder(leaf)).parent_id, child);
  const doc = (await api.readLocalSync("test-owner")).document;
  const folderKey = Object.keys(doc.folders).find((key) => doc.folders[key].name === "Unidad 1");
  assert.equal(doc.folders[doc.folders[folderKey].parent_id].name, "Marketing");
  const rootKey = Object.keys(doc.folders).find((key) => doc.folders[key].name === "Facultad");
  const remote = structuredClone(doc);
  remote.folders[folderKey].parent_id = rootKey;
  assert.equal(await api.applyLocalSync("test-owner", doc, remote, remote, []), true);
  assert.equal((await api.getFolder(leaf)).parent_id, root);
  await api.restoreBackup(db, backup);
  const shared = await api.buildDeckExport(db, deck);
  assert.equal(shared.cards[0].reps, 0);
  assert.equal(shared.review_logs.length, 0);
  assert.equal(JSON.stringify(shared).includes("NO-COMPARTIR"), false);
  await api.deleteFolder(child);
  assert.equal((await api.getFolder(leaf)).parent_id, root);
  assert.equal((await api.getCard(card)).deck_id, deck);
  await api.deleteFolder(leaf);
  assert.equal((await raw.getFirstAsync("SELECT folder_id FROM decks WHERE id = ?", [deck])).folder_id, null);
  // Importar el respaldo con IDs ocupados prueba el remapeo de TODA la cadena.
  await db.execAsync("DELETE FROM review_logs; DELETE FROM cards; DELETE FROM decks; DELETE FROM folders;");
  await db.runAsync("INSERT INTO folders(id,name,created_at) VALUES(50,'Preexistente',?)", [new Date().toISOString()]);
  const plan = await api.prepareAdditiveImport(db, backup);
  await api.applyAdditiveImport(db, backup, plan.initialSelection, plan);
  const imported = await api.listFolders();
  const importedLeaf = imported.find((folder) => folder.name === "Unidad 1");
  const importedChild = imported.find((folder) => folder.id === importedLeaf.parent_id);
  assert.equal(importedChild.name, "Marketing");
  assert.equal(imported.find((folder) => folder.id === importedChild.parent_id).name, "Facultad");
  assert.ok(importedLeaf.id > 50);
  const importedCard = await raw.getFirstAsync("SELECT * FROM cards");
  const importedDeck = await raw.getFirstAsync("SELECT * FROM decks WHERE id = ?", [importedCard.deck_id]);
  assert.equal(importedDeck.folder_id, importedLeaf.id);
  assert.equal((await raw.getFirstAsync("SELECT value FROM settings WHERE key='privateKey'")).value, "NO-COMPARTIR");
  console.log("OK: SQLite real, carpetas anidadas, rechazo de ciclos, borrado conservador, respaldo/restauración, referencias de sync, export privado e importación con IDs remapeados.");
} finally { sqlite.close(); delete globalThis.activecardLibraryTestDb; }
