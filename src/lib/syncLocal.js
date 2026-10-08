import { getDb } from "../db/client";
import { getDatabaseRevision, withDbTransaction } from "../db/transactions";
import { buildBackup } from "./backup";
import { COLUMNS, REFERENCES, documentFromBackup, mapMetadata, same, validateDocument } from "./syncDocument";

const snapshots = new WeakMap();
export async function readLocalSync(owner) {
  const db = await getDb();
  return withDbTransaction(db, async (tx) => {
    const revision = getDatabaseRevision(db);
    const cached = snapshots.get(db);
    if (revision !== null && cached?.revision === revision && cached.owner === owner) return cached.result;
    const bound = await tx.getFirstAsync("SELECT value FROM sync_state WHERE key = 'owner'");
    if (bound && bound.value !== owner) throw new Error("Esta biblioteca está vinculada a otra cuenta. Cerrá sesión para conservar sus datos.");
    const checkpoint = await tx.getFirstAsync("SELECT value FROM sync_state WHERE key = ?", [`checkpoint:${owner}`]);
    const backup = await buildBackup(tx);
    const document = documentFromBackup(backup);
    const previous = checkpoint ? JSON.parse(checkpoint.value) : null;
    const result = { backup, document, checkpoint: previous, clean: Boolean(previous && same(document, previous.document)) };
    if (revision !== null) snapshots.set(db, { owner, revision, result });
    return result;
  });
}
async function installDocument(tx, doc, current) {
  validateDocument(doc);
  const maps = {};
  for (const table of Object.keys(COLUMNS)) {
    const previous = new Map(current[table].map((row) => [table === "tags" ? `tag:${row.name}` : row.sync_id, row.id]));
    let nextId = current[table].reduce((maximum, row) => Math.max(maximum, row.id), 0);
    maps[table] = new Map(Object.keys(doc[table]).sort().map((id) => [id, previous.get(id) || ++nextId]));
  }
  for (const table of ["gym_messages", "gym_chats", "connections", "review_logs", "deck_tags", "cards", "tags", "decks", "folders"]) await tx.execAsync(`DELETE FROM ${table}`);
  for (const [table, columns] of Object.entries(COLUMNS)) {
    for (const [id, row] of Object.entries(doc[table])) {
      const values = columns.map((column) => REFERENCES[column] ? maps[REFERENCES[column]].get(row[column]) ?? null : row[column]);
      if (table === "gym_messages") values[columns.indexOf("metadata")] = mapMetadata(row.metadata, maps);
      const names = ["id", "sync_id", ...columns];
      await tx.runAsync(`INSERT INTO ${table} (${names.join(", ")}) VALUES (${names.map(() => "?").join(", ")})`, [maps[table].get(id), id, ...values]);
    }
  }
  for (const [deck, tag] of doc.deck_tags) await tx.runAsync("INSERT INTO deck_tags (deck_id, tag_id) VALUES (?, ?)", [maps.decks.get(deck), maps.tags.get(tag)]);
}
async function archive(tx, owner, backup, remote, reason) {
  await tx.runAsync("INSERT INTO sync_recovery (owner, created_at, reason, local_backup, remote_document) VALUES (?, ?, ?, ?, ?)", [owner, new Date().toISOString(), reason, JSON.stringify(backup), JSON.stringify(remote)]);
}
// La comparación y la instalación corren juntas: una edición que apareció
// durante una descarga provoca un reintento y nunca queda sobrescrita.
export async function applyLocalSync(owner, expected, merged, remote, conflicts, canApply = () => true) {
  const db = await getDb();
  return withDbTransaction(db, async (tx) => {
    if (!canApply()) return false;
    const backup = await buildBackup(tx);
    if (!canApply() || !same(documentFromBackup(backup), expected)) return false;
    await archive(tx, owner, backup, remote, conflicts.length ? `${conflicts.length} conflictos; se conserva la alternativa local` : "Antes de incorporar cambios de otro dispositivo");
    await installDocument(tx, merged, backup);
    return true;
  });
}
export async function saveCheckpoint(owner, document, revision) {
  const db = await getDb();
  await withDbTransaction(db, async (tx) => {
    await tx.runAsync("INSERT OR REPLACE INTO sync_state (key, value) VALUES ('owner', ?)", [owner]);
    await tx.runAsync("INSERT OR REPLACE INTO sync_state (key, value) VALUES (?, ?)", [`checkpoint:${owner}`, JSON.stringify({ document, revision })]);
    const cached = snapshots.get(db);
    if (cached?.owner === owner) {
      cached.result.checkpoint = { document, revision };
      cached.result.clean = same(cached.result.document, document);
    }
  });
}
export async function listRecoveries(owner) {
  const db = await getDb();
  return db.getAllAsync("SELECT id, created_at, reason FROM sync_recovery WHERE owner = ? ORDER BY id DESC LIMIT 20", [owner]);
}
export async function restoreRecovery(owner, id) {
  const db = await getDb();
  await withDbTransaction(db, async (tx) => {
    const row = await tx.getFirstAsync("SELECT local_backup FROM sync_recovery WHERE id = ? AND owner = ?", [id, owner]);
    if (!row) throw new Error("No se encontró esa copia de recuperación.");
    const backup = await buildBackup(tx);
    const target = documentFromBackup(JSON.parse(row.local_backup));
    await archive(tx, owner, backup, target, "Antes de restaurar una copia de recuperación");
    await installDocument(tx, target, backup);
  });
}
