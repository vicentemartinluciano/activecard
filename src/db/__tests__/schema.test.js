import { MIGRATIONS, migrate } from "../schema";

// Doble mínimo de una conexión expo-sqlite async: registra qué se ejecuta
// y simula PRAGMA user_version.
function fakeDb(initialVersion = 0) {
  let version = initialVersion;
  const executed = [];
  return {
    executed,
    get version() {
      return version;
    },
    async getFirstAsync(sql) {
      if (sql.includes("user_version")) return { user_version: version };
      return null;
    },
    async execAsync(sql) {
      executed.push(sql);
      const m = sql.match(/PRAGMA user_version = (\d+)/);
      if (m) version = Number(m[1]);
      if (sql.includes("FALLAR")) throw new Error("sql inválido");
    },
  };
}

describe("migraciones de esquema", () => {
  test("aplica todas las migraciones desde cero y fija la versión final", async () => {
    const db = fakeDb(0);
    await migrate(db);
    expect(db.version).toBe(MIGRATIONS.length);
    for (const sql of MIGRATIONS) {
      expect(db.executed).toContain(sql);
    }
  });

  test("es idempotente: en una DB al día no ejecuta nada", async () => {
    const db = fakeDb(MIGRATIONS.length);
    await migrate(db);
    expect(db.executed.filter((s) => s.includes("CREATE TABLE"))).toHaveLength(0);
  });

  test("cada migración corre dentro de una transacción", async () => {
    const db = fakeDb(0);
    await migrate(db);
    const begins = db.executed.filter((s) => s === "BEGIN").length;
    const commits = db.executed.filter((s) => s === "COMMIT").length;
    expect(begins).toBe(MIGRATIONS.length);
    expect(commits).toBe(MIGRATIONS.length);
  });

  test("si una migración falla hace ROLLBACK y no avanza la versión", async () => {
    const db = fakeDb(0);
    const original = MIGRATIONS[0];
    MIGRATIONS[0] = "FALLAR";
    try {
      await expect(migrate(db)).rejects.toThrow();
      expect(db.executed).toContain("ROLLBACK");
      expect(db.version).toBe(0);
    } finally {
      MIGRATIONS[0] = original;
    }
  });

  test("la migración v3 crea folders y agrega folder_id a decks", () => {
    expect(MIGRATIONS[2]).toContain("CREATE TABLE IF NOT EXISTS folders");
    expect(MIGRATIONS[2]).toContain("ALTER TABLE decks ADD COLUMN folder_id");
    expect(MIGRATIONS[2]).toContain("CREATE INDEX IF NOT EXISTS idx_decks_folder");
  });

  test("el esquema inicial define todas las tablas del plan", () => {
    for (const table of [
      "decks",
      "tags",
      "deck_tags",
      "cards",
      "review_logs",
      "connections",
      "priorities",
      "settings",
    ]) {
      expect(MIGRATIONS[0]).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
  });
});
