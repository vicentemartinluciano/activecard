import { manageDatabase, withDbTransaction } from "../transactions";
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
