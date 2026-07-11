// Esquema de la base de datos local de ActiveCard.
// Migraciones versionadas: PRAGMA user_version guarda la última aplicada.
// Para cambiar el esquema, AGREGAR una migración nueva al final (nunca editar
// las anteriores: los teléfonos ya instalados las aplicaron).

export const MIGRATIONS = [
  // v1 — esquema inicial
  `
  CREATE TABLE IF NOT EXISTS decks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS deck_tags (
    deck_id INTEGER NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (deck_id, tag_id)
  );

  CREATE TABLE IF NOT EXISTS cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    deck_id INTEGER NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
    front TEXT NOT NULL,
    back TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'manual',
    origin_card_id INTEGER,
    created_at TEXT NOT NULL,
    due TEXT NOT NULL,
    stability REAL NOT NULL DEFAULT 0,
    difficulty REAL NOT NULL DEFAULT 0,
    elapsed_days INTEGER NOT NULL DEFAULT 0,
    scheduled_days INTEGER NOT NULL DEFAULT 0,
    reps INTEGER NOT NULL DEFAULT 0,
    lapses INTEGER NOT NULL DEFAULT 0,
    learning_steps INTEGER NOT NULL DEFAULT 0,
    state INTEGER NOT NULL DEFAULT 0,
    last_review TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_cards_due ON cards(due);
  CREATE INDEX IF NOT EXISTS idx_cards_deck ON cards(deck_id);

  CREATE TABLE IF NOT EXISTS review_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    rating TEXT NOT NULL,
    mode TEXT NOT NULL,
    reviewed_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS connections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    final_text TEXT NOT NULL,
    transcript TEXT,
    hybrid_card_id INTEGER,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS priorities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    target_type TEXT NOT NULL,
    target_id INTEGER NOT NULL,
    weight INTEGER NOT NULL DEFAULT 1,
    month TEXT NOT NULL,
    UNIQUE (target_type, target_id, month)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
  `,

  // v2 — prioridad porcentual e ícono por mazo.
  // Reemplazan al Modo Enfoque y a las prioridades mensuales (la tabla
  // priorities queda huérfana a propósito: no se borra, solo se deja de usar).
  `
  ALTER TABLE decks ADD COLUMN priority INTEGER NOT NULL DEFAULT 100;
  ALTER TABLE decks ADD COLUMN icon TEXT;
  `,
];

// Aplica las migraciones pendientes sobre una conexión expo-sqlite (async).
export async function migrate(db) {
  const row = await db.getFirstAsync("PRAGMA user_version");
  const current = row ? row.user_version : 0;
  for (let v = current; v < MIGRATIONS.length; v++) {
    await db.execAsync("BEGIN");
    try {
      await db.execAsync(MIGRATIONS[v]);
      await db.execAsync(`PRAGMA user_version = ${v + 1}`);
      await db.execAsync("COMMIT");
    } catch (e) {
      await db.execAsync("ROLLBACK");
      throw e;
    }
  }
}
