const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');
const config = require('./config');

const dbDir = path.dirname(config.dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new DatabaseSync(config.dbPath);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT    NOT NULL,
    email         TEXT    NOT NULL UNIQUE,
    password_hash TEXT    NOT NULL,
    role          TEXT    NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
    can_manage    INTEGER NOT NULL DEFAULT 0 CHECK (can_manage IN (0,1)),
    is_active     INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS shifts (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    started_at TEXT    NOT NULL DEFAULT (datetime('now')),
    ended_at   TEXT,
    scheduled_start TEXT,
    scheduled_end   TEXT,
    deficit_minutes INTEGER NOT NULL DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_shifts_user   ON shifts(user_id);
  CREATE INDEX IF NOT EXISTS idx_shifts_started ON shifts(started_at);

  CREATE TABLE IF NOT EXISTS projects (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    intermediary_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    executor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    shift_id   INTEGER REFERENCES shifts(id) ON DELETE SET NULL,
    code       TEXT    NOT NULL DEFAULT '',
    title      TEXT    NOT NULL,
    project_type TEXT NOT NULL DEFAULT 'other',
    amount     REAL    NOT NULL DEFAULT 0,
      status     TEXT    NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','done')),
      request_status TEXT NOT NULL DEFAULT 'pending' CHECK (request_status IN ('pending','approved','rejected')),
      approved_at TEXT,
      approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      is_confirmed INTEGER NOT NULL DEFAULT 0 CHECK (is_confirmed IN (0,1)),
    notes      TEXT    NOT NULL DEFAULT '',
    phone      TEXT    NOT NULL DEFAULT '',
    due_date   TEXT,
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_projects_user     ON projects(user_id);
  CREATE INDEX IF NOT EXISTS idx_projects_shift    ON projects(shift_id);
  CREATE INDEX IF NOT EXISTS idx_projects_created  ON projects(created_at);
`);

function ensureColumn(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
  }
}

ensureColumn('users', 'can_manage', 'INTEGER NOT NULL DEFAULT 0 CHECK (can_manage IN (0,1))');
ensureColumn('users', 'is_active', 'INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1))');
ensureColumn('users', 'shift_start', 'TEXT');
ensureColumn('users', 'shift_end', 'TEXT');
ensureColumn('users', 'hourly_rate', 'REAL NOT NULL DEFAULT 0');
ensureColumn('users', 'manual_deficit', 'REAL NOT NULL DEFAULT 0');
ensureColumn('users', 'persona', "TEXT NOT NULL DEFAULT 'specialist'");
ensureColumn('users', 'specialist_code', 'TEXT');
ensureColumn('projects', 'phone', 'TEXT NOT NULL DEFAULT \'\'');
ensureColumn('projects', 'executor_id', 'INTEGER REFERENCES users(id) ON DELETE SET NULL');
ensureColumn('projects', 'intermediary_id', 'INTEGER REFERENCES users(id) ON DELETE SET NULL');
ensureColumn('projects', 'request_status', "TEXT NOT NULL DEFAULT 'pending'");
ensureColumn('projects', 'approved_at', 'TEXT');
ensureColumn('projects', 'approved_by', 'INTEGER REFERENCES users(id) ON DELETE SET NULL');
ensureColumn('projects', 'client_name', 'TEXT NOT NULL DEFAULT \'\'');
ensureColumn('projects', 'code', 'TEXT NOT NULL DEFAULT \'\'');
ensureColumn('projects', 'due_date', 'TEXT');
ensureColumn('projects', 'delivery_time', 'TEXT');
ensureColumn('projects', 'currency', 'TEXT NOT NULL DEFAULT \'egp\'');
ensureColumn('shifts', 'deficit_minutes', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('shifts', 'scheduled_start', 'TEXT');
ensureColumn('shifts', 'scheduled_end', 'TEXT');

db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_code ON projects(code) WHERE code != \'\'');
db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_specialist_code ON users(specialist_code) WHERE specialist_code IS NOT NULL AND specialist_code != ''");

for (const user of db.prepare("SELECT id FROM users WHERE persona = 'specialist' AND (specialist_code IS NULL OR TRIM(specialist_code) = '') ORDER BY id").all()) {
  db.prepare('UPDATE users SET specialist_code = ? WHERE id = ?').run(`SPEC-${user.id}`, user.id);
}

module.exports = db;