import { getDatabaseRevision, manageDatabase, subscribeDatabaseChanges, withDbTransaction } from "../transactions";
test("una escritura ajena espera el COMMIT de la transacción", async () => {
  const events = []; let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const db = manageDatabase({ execAsync: async (sql) => events.push(sql), runAsync: async (sql) => events.push(sql) });
  const transaction = withDbTransaction(db, async (tx) => { await tx.runAsync("FSRS"); await gate; await tx.runAsync("LOG"); });
  const other = db.runAsync("EDICIÓN");
  await Promise.resolve(); await Promise.resolve();
  expect(events).not.toContain("EDICIÓN");
  release(); await Promise.all([transaction, other]);
  expect(events).toEqual(["BEGIN", "FSRS", "LOG", "COMMIT", "EDICIÓN"]);
});
test("un fallo revierte la transacción y deja la cola utilizable", async () => {
  const events = [];
  const db = manageDatabase({ execAsync: async (sql) => events.push(sql), runAsync: async (sql) => events.push(sql) });
  await expect(withDbTransaction(db, async () => { throw new Error("Fallo al guardar log"); })).rejects.toThrow();
  await db.runAsync("SIGUIENTE");
  expect(events).toEqual(["BEGIN", "ROLLBACK", "SIGUIENTE"]);
});

test("los observadores reciben un único aviso después de confirmar una transacción", async () => {
  const events = [];
  const db = manageDatabase({ execAsync: async (sql) => events.push(sql), runAsync: async () => {} });
  const unsubscribe = subscribeDatabaseChanges(db, (revision) => events.push(`changed:${revision}`));
  await withDbTransaction(db, async (tx) => {
    await tx.runAsync('UPDATE cards SET front = ?');
    await tx.runAsync('INSERT INTO review_logs VALUES (?)');
    expect(events).toEqual(['BEGIN']);
  });
  expect(events).toEqual(['BEGIN', 'COMMIT', 'changed:1']);
  unsubscribe();
  await db.runAsync('UPDATE decks SET name = ?');
  expect(getDatabaseRevision(db)).toBe(2);
  expect(events).toHaveLength(3);
});

test("rollback, claves locales y checkpoints no anuncian contenido pendiente", async () => {
  const db = manageDatabase({ execAsync: async () => {}, runAsync: async () => {} });
  const listener = jest.fn();
  subscribeDatabaseChanges(db, listener);
  await expect(withDbTransaction(db, async (tx) => {
    await tx.runAsync('UPDATE cards SET front = ?');
    throw new Error('No guardar');
  })).rejects.toThrow('No guardar');
  await db.runAsync('UPDATE settings SET value = ?');
  await db.runAsync('INSERT INTO sync_state VALUES (?)');
  expect(listener).not.toHaveBeenCalled();
  expect(getDatabaseRevision(db)).toBe(0);
  await db.runAsync('UPDATE study_preferences SET max_reviews = ?');
  expect(listener).toHaveBeenCalledWith(1);
});

test("un observador que falla no revierte ni bloquea las escrituras", async () => {
  const db = manageDatabase({ execAsync: async () => {}, runAsync: async () => {} });
  subscribeDatabaseChanges(db, () => { throw new Error('UI'); });
  await withDbTransaction(db, (tx) => tx.runAsync('UPDATE cards SET back = ?'));
  await db.runAsync('UPDATE cards SET front = ?');
  expect(getDatabaseRevision(db)).toBe(2);
});
