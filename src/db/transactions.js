// Todas las operaciones de una conexión administrada pasan por una misma cola.
// El callback de una transacción recibe la conexión cruda, sin volver a encolarse.
const managers = new WeakMap();
const changesContent = (sql) => /\b(?:INSERT|UPDATE|DELETE|REPLACE|ALTER)\b/i.test(String(sql)) && /\b(?:folders|decks|tags|deck_tags|cards|review_logs|connections|gym_chats|gym_messages|study_preferences)\b/i.test(String(sql));
export const getDatabaseRevision = (db) => managers.get(db)?.revision ?? null;
export function withDbConnection(db, task) {
  const manager = managers.get(db);
  return manager ? manager.enqueue(() => task(manager.raw)) : task(db);
}
export function manageDatabase(raw) {
  const manager = { raw, revision: 0 };
  let tail = Promise.resolve();
  const enqueue = (task) => {
    const result = tail.then(task);
    tail = result.catch(() => {});
    return result;
  };
  const managed = new Proxy(raw, {
    get(target, key) {
      const value = target[key];
      if (typeof value !== "function") return value;
      return (...args) => enqueue(async () => {
        const result = await value.apply(target, args);
        if ((key === "runAsync" || key === "execAsync") && changesContent(args[0])) manager.revision++;
        return result;
      });
    },
  });
  manager.enqueue = enqueue;
  managers.set(managed, manager);
  return managed;
}
export function withDbTransaction(db, task) {
  const manager = managers.get(db);
  const run = async () => {
    const connection = manager?.raw || db;
    let changed = false;
    const tx = manager ? new Proxy(connection, { get(target, key) {
      const value = target[key];
      if (typeof value !== "function") return value;
      return async (...args) => {
        const result = await value.apply(target, args);
        if ((key === "runAsync" || key === "execAsync") && changesContent(args[0])) changed = true;
        return result;
      };
    } }) : connection;
    await connection.execAsync("BEGIN");
    try {
      const result = await task(tx);
      await connection.execAsync("COMMIT");
      if (changed) manager.revision++;
      return result;
    } catch (error) {
      await connection.execAsync("ROLLBACK");
      throw error;
    }
  };
  return manager ? manager.enqueue(run) : run();
}
