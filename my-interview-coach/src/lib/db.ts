import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'interview-coach.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    runMigrations(db);
  }
  return db;
}

function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      filename      TEXT NOT NULL,
      content       TEXT NOT NULL,
      file_type     TEXT NOT NULL DEFAULT 'md',
      created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS chunks (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id   INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      chunk_index   INTEGER NOT NULL,
      content       TEXT NOT NULL,
      embedding     TEXT,
      token_count   INTEGER DEFAULT 0,
      created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_chunks_document ON chunks(document_id);

    CREATE TABLE IF NOT EXISTS cards (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      question        TEXT NOT NULL,
      answer          TEXT NOT NULL,
      category        TEXT NOT NULL DEFAULT 'other'
                      CHECK(category IN ('technical','behavioral','project','self_intro','other')),
      tags            TEXT DEFAULT '[]',
      source          TEXT DEFAULT 'manual' CHECK(source IN ('manual','from_chat')),
      source_chat_id  INTEGER,
      created_at      TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at      TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_cards_category ON cards(category);
    CREATE INDEX IF NOT EXISTS idx_cards_created ON cards(created_at);

    CREATE TABLE IF NOT EXISTS chat_sessions (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      title         TEXT NOT NULL DEFAULT '新对话',
      mode          TEXT NOT NULL DEFAULT 'interviewer_role'
                    CHECK(mode IN ('interviewer_role','self_role')),
      created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id        INTEGER NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
      role              TEXT NOT NULL CHECK(role IN ('user','assistant','system')),
      content           TEXT NOT NULL,
      is_corrected      INTEGER NOT NULL DEFAULT 0,
      corrected_content TEXT,
      saved_as_card_id  INTEGER,
      created_at        TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_messages_session ON chat_messages(session_id);

    CREATE TABLE IF NOT EXISTS app_config (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    INSERT OR IGNORE INTO app_config (key, value) VALUES ('llm_api_key', '');
    INSERT OR IGNORE INTO app_config (key, value) VALUES ('llm_base_url', 'https://api.deepseek.com');
    INSERT OR IGNORE INTO app_config (key, value) VALUES ('llm_model', 'deepseek-chat');
    INSERT OR IGNORE INTO app_config (key, value) VALUES ('embedding_model', 'deepseek-chat');
    INSERT OR IGNORE INTO app_config (key, value) VALUES ('user_name', '');

    CREATE TABLE IF NOT EXISTS profile_data (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_json        TEXT NOT NULL,
      source_document_ids TEXT NOT NULL DEFAULT '[]',
      created_at          TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
  `);
}

export function getSetting(key: string): string {
  const row = getDb().prepare('SELECT value FROM app_config WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? '';
}

export function setSetting(key: string, value: string): void {
  getDb().prepare('INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?)').run(key, value);
}

export function getAllSettings(): Record<string, string> {
  const rows = getDb().prepare('SELECT key, value FROM app_config').all() as { key: string; value: string }[];
  const settings: Record<string, string> = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  return settings;
}
