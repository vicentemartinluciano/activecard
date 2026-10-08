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

  // v3 — carpetas que agrupan mazos (un mazo pertenece a 0 o 1 carpeta).
  // folder_id va SIN REFERENCES a propósito: PRAGMA foreign_keys está ON y una
  // FK real obligaría a ordenar los inserts del restore de respaldos viejos.
  // La integridad la garantiza la app: deleteFolder desasigna los mazos en la
  // misma transacción en la que borra la carpeta.
  `
  CREATE TABLE IF NOT EXISTS folders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  ALTER TABLE decks ADD COLUMN folder_id INTEGER;
  CREATE INDEX IF NOT EXISTS idx_decks_folder ON decks(folder_id);
  `,

  // v4 — estrellas estilo Quizlet y orden manual de tarjetas dentro del mazo.
  // position arranca igual al id (mismo orden de creación); los respaldos
  // viejos restauran con los DEFAULT (el restore inserta solo las columnas
  // presentes en cada fila).
  `
  ALTER TABLE cards ADD COLUMN starred INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE cards ADD COLUMN position INTEGER;
  UPDATE cards SET position = id;
  CREATE INDEX IF NOT EXISTS idx_cards_deck_pos ON cards(deck_id, position);
  `,

  // v5 — tarjetas suspendidas (leeches o contenido que necesita corrección).
  // Siguen visibles y respaldables, pero quedan fuera de cualquier cola.
  `
  ALTER TABLE cards ADD COLUMN suspended INTEGER NOT NULL DEFAULT 0;
  `,

  // v6 — índices para estadísticas, última nota diaria y tarjetas híbridas.
  // No cambia columnas ni datos, por lo que es compatible con bases y
  // respaldos de cualquier versión anterior.
  `
  CREATE INDEX IF NOT EXISTS idx_review_logs_reviewed_at
    ON review_logs(reviewed_at);
  CREATE INDEX IF NOT EXISTS idx_review_logs_card_reviewed_at
    ON review_logs(card_id, reviewed_at DESC, id DESC);
  CREATE INDEX IF NOT EXISTS idx_connections_hybrid_card_id
    ON connections(hybrid_card_id);
  `,

  // v7 — conversaciones persistentes del Gimnasio Mental.
  `
  CREATE TABLE IF NOT EXISTS gym_chats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL DEFAULT 'Nueva charla',
    origin_card_id INTEGER,
    draft_text TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_gym_chats_updated_at
    ON gym_chats(updated_at DESC, id DESC);

  CREATE TABLE IF NOT EXISTS gym_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER NOT NULL REFERENCES gym_chats(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    text TEXT NOT NULL,
    metadata TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_gym_messages_chat
    ON gym_messages(chat_id, created_at ASC, id ASC);
  `,
  // v8 — identidades entre dispositivos y recuperación de sincronización.
  `
  ALTER TABLE folders ADD COLUMN sync_id TEXT;
  UPDATE folders SET sync_id = 'legacy:folders:' || id || ':' || created_at;
  CREATE UNIQUE INDEX idx_folders_sync_id ON folders(sync_id);
  CREATE TRIGGER folders_sync_identity AFTER INSERT ON folders
    WHEN NEW.sync_id IS NULL BEGIN
    UPDATE folders SET sync_id = lower(hex(randomblob(16))) WHERE id = NEW.id;
  END;
  ALTER TABLE decks ADD COLUMN sync_id TEXT;
  UPDATE decks SET sync_id = 'legacy:decks:' || id || ':' || created_at;
  CREATE UNIQUE INDEX idx_decks_sync_id ON decks(sync_id);
  CREATE TRIGGER decks_sync_identity AFTER INSERT ON decks
    WHEN NEW.sync_id IS NULL BEGIN
    UPDATE decks SET sync_id = lower(hex(randomblob(16))) WHERE id = NEW.id;
  END;
  ALTER TABLE tags ADD COLUMN sync_id TEXT;
  UPDATE tags SET sync_id = 'legacy:tags:' || id || ':' || name;
  CREATE UNIQUE INDEX idx_tags_sync_id ON tags(sync_id);
  CREATE TRIGGER tags_sync_identity AFTER INSERT ON tags
    WHEN NEW.sync_id IS NULL BEGIN
    UPDATE tags SET sync_id = lower(hex(randomblob(16))) WHERE id = NEW.id;
  END;
  ALTER TABLE cards ADD COLUMN sync_id TEXT;
  UPDATE cards SET sync_id = 'legacy:cards:' || id || ':' || created_at;
  CREATE UNIQUE INDEX idx_cards_sync_id ON cards(sync_id);
  CREATE TRIGGER cards_sync_identity AFTER INSERT ON cards
    WHEN NEW.sync_id IS NULL BEGIN
    UPDATE cards SET sync_id = lower(hex(randomblob(16))) WHERE id = NEW.id;
  END;
  ALTER TABLE review_logs ADD COLUMN sync_id TEXT;
  UPDATE review_logs SET sync_id = 'legacy:review_logs:' || id || ':' || reviewed_at;
  CREATE UNIQUE INDEX idx_review_logs_sync_id ON review_logs(sync_id);
  CREATE TRIGGER review_logs_sync_identity AFTER INSERT ON review_logs
    WHEN NEW.sync_id IS NULL BEGIN
    UPDATE review_logs SET sync_id = lower(hex(randomblob(16))) WHERE id = NEW.id;
  END;
  ALTER TABLE connections ADD COLUMN sync_id TEXT;
  UPDATE connections SET sync_id = 'legacy:connections:' || id || ':' || created_at;
  CREATE UNIQUE INDEX idx_connections_sync_id ON connections(sync_id);
  CREATE TRIGGER connections_sync_identity AFTER INSERT ON connections
    WHEN NEW.sync_id IS NULL BEGIN
    UPDATE connections SET sync_id = lower(hex(randomblob(16))) WHERE id = NEW.id;
  END;
  ALTER TABLE gym_chats ADD COLUMN sync_id TEXT;
  UPDATE gym_chats SET sync_id = 'legacy:gym_chats:' || id || ':' || created_at;
  CREATE UNIQUE INDEX idx_gym_chats_sync_id ON gym_chats(sync_id);
  CREATE TRIGGER gym_chats_sync_identity AFTER INSERT ON gym_chats
    WHEN NEW.sync_id IS NULL BEGIN
    UPDATE gym_chats SET sync_id = lower(hex(randomblob(16))) WHERE id = NEW.id;
  END;
  ALTER TABLE gym_messages ADD COLUMN sync_id TEXT;
  UPDATE gym_messages SET sync_id = 'legacy:gym_messages:' || id || ':' || created_at;
  CREATE UNIQUE INDEX idx_gym_messages_sync_id ON gym_messages(sync_id);
  CREATE TRIGGER gym_messages_sync_identity AFTER INSERT ON gym_messages
    WHEN NEW.sync_id IS NULL BEGIN
    UPDATE gym_messages SET sync_id = lower(hex(randomblob(16))) WHERE id = NEW.id;
  END;
  CREATE TABLE sync_state (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE sync_recovery (id INTEGER PRIMARY KEY AUTOINCREMENT, owner TEXT NOT NULL, created_at TEXT NOT NULL, reason TEXT NOT NULL, local_backup TEXT NOT NULL, remote_document TEXT NOT NULL);
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
