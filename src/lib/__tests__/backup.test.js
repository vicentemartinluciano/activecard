import { buildBackup, restoreBackup } from "../backup";

const TABLES = ["folders", "decks", "tags", "deck_tags", "cards", "review_logs", "connections"];

// Doble mínimo de una conexión expo-sqlite async con tablas en memoria.
function fakeDb(initialTables = {}) {
  const tables = {};
  for (const t of TABLES) tables[t] = initialTables[t] ? [...initialTables[t]] : [];
  const log = [];

  return {
    tables,
    log,
    async getAllAsync(sql) {
      const m = /FROM (\w+)/.exec(sql);
      return tables[m[1]].map((r) => ({ ...r }));
    },
    async execAsync(sql) {
      log.push(sql);
      const del = /DELETE FROM (\w+)/.exec(sql);
      if (del) tables[del[1]] = [];
    },
    async runAsync(sql, params) {
      const m = /INSERT INTO (\w+) \(([^)]+)\)/.exec(sql);
      const table = m[1];
      const cols = m[2].split(",").map((c) => c.trim());
      const row = {};
      cols.forEach((c, i) => (row[c] = params[i]));
      tables[table].push(row);
    },
  };
}

const NOW = new Date("2026-07-11T12:00:00Z");

describe("buildBackup", () => {
  test("incluye app/version/exportedAt y todas las tablas de datos del usuario", async () => {
    const db = fakeDb({
      decks: [{ id: 1, name: "Administración", created_at: "x" }],
      cards: [{ id: 1, deck_id: 1, front: "f", back: "b" }],
    });
    const backup = await buildBackup(db, NOW);
    expect(backup.app).toBe("activecard");
    expect(backup.version).toBe(2);
    expect(backup.exportedAt).toBe(NOW.toISOString());
    expect(backup.decks).toEqual([{ id: 1, name: "Administración", created_at: "x" }]);
    expect(backup.cards).toEqual([{ id: 1, deck_id: 1, front: "f", back: "b" }]);
    for (const t of TABLES) expect(Array.isArray(backup[t])).toBe(true);
  });

  test("NO incluye la tabla settings (ahí viven las claves)", async () => {
    const db = fakeDb();
    const backup = await buildBackup(db, NOW);
    expect(backup.settings).toBeUndefined();
  });
});

describe("restoreBackup", () => {
  const validBackup = {
    app: "activecard",
    version: 2,
    exportedAt: NOW.toISOString(),
    folders: [],
    decks: [{ id: 1, name: "Nuevo mazo", created_at: "x" }],
    tags: [],
    deck_tags: [],
    cards: [{ id: 1, deck_id: 1, front: "f", back: "b" }],
    review_logs: [],
    connections: [],
  };

  test("reemplaza los datos actuales por los del respaldo", async () => {
    const db = fakeDb({ decks: [{ id: 99, name: "Mazo viejo", created_at: "y" }] });
    const counts = await restoreBackup(db, validBackup);
    expect(db.tables.decks).toEqual(validBackup.decks);
    expect(db.tables.cards).toEqual(validBackup.cards);
    expect(counts).toEqual({
      folders: 0,
      decks: 1,
      tags: 0,
      deck_tags: 0,
      cards: 1,
      review_logs: 0,
      connections: 0,
    });
  });

  test("restaura un respaldo v1 (sin folders) dejando folders vacío", async () => {
    const db = fakeDb({
      folders: [{ id: 7, name: "Carpeta vieja", created_at: "z" }],
    });
    const v1 = { ...validBackup, version: 1 };
    delete v1.folders;
    const counts = await restoreBackup(db, v1);
    expect(counts.folders).toBe(0);
    expect(db.tables.folders).toEqual([]);
    expect(db.tables.decks).toEqual(validBackup.decks);
  });

  test("roundtrip v2 con carpetas: exportar y reimportar conserva todo", async () => {
    const source = fakeDb({
      folders: [{ id: 1, name: "Facultad", created_at: "x" }],
      decks: [{ id: 1, name: "Filosofía", created_at: "x", folder_id: 1 }],
      cards: [{ id: 1, deck_id: 1, front: "f", back: "b" }],
    });
    const backup = await buildBackup(source, NOW);
    const target = fakeDb();
    const counts = await restoreBackup(target, backup);
    expect(counts.folders).toBe(1);
    expect(target.tables.folders).toEqual(source.tables.folders);
    expect(target.tables.decks).toEqual(source.tables.decks);
    expect(target.tables.cards).toEqual(source.tables.cards);
  });

  test("rechaza folders no-array en un respaldo v2", async () => {
    const db = fakeDb();
    await expect(
      restoreBackup(db, { ...validBackup, folders: "no es un array" })
    ).rejects.toThrow(/folders/);
  });

  test("corre dentro de una transacción (BEGIN...COMMIT)", async () => {
    const db = fakeDb();
    await restoreBackup(db, validBackup);
    expect(db.log[0]).toBe("BEGIN");
    expect(db.log[db.log.length - 1]).toBe("COMMIT");
  });

  test("rechaza un archivo que no es de ActiveCard", async () => {
    const db = fakeDb();
    await expect(restoreBackup(db, { app: "otra-app", version: 1 })).rejects.toThrow(
      /no es un respaldo/
    );
  });

  test("rechaza una versión de respaldo no soportada", async () => {
    const db = fakeDb();
    await expect(
      restoreBackup(db, { ...validBackup, version: 99 })
    ).rejects.toThrow(/versión/i);
  });

  test("rechaza un archivo sin la forma esperada", async () => {
    const db = fakeDb();
    await expect(restoreBackup(db, null)).rejects.toThrow(/formato válido/);
    await expect(
      restoreBackup(db, { app: "activecard", version: 1, decks: "no es un array" })
    ).rejects.toThrow(/decks/);
  });

  test("si falla a mitad de camino, no deja los datos a medio borrar (ROLLBACK)", async () => {
    const db = fakeDb({ decks: [{ id: 5, name: "Mazo original", created_at: "z" }] });
    const broken = { ...validBackup, cards: [{ id: 1 /* faltan columnas → mismo largo igual, no falla real */ }] };
    // Forzamos un runAsync que tire error en la segunda tabla insertada.
    const original = db.runAsync.bind(db);
    let calls = 0;
    db.runAsync = async (...args) => {
      calls++;
      if (calls === 1) throw new Error("boom");
      return original(...args);
    };
    await expect(restoreBackup(db, broken)).rejects.toThrow("boom");
    expect(db.log).toContain("ROLLBACK");
    expect(db.log).not.toContain("COMMIT");
  });
});
