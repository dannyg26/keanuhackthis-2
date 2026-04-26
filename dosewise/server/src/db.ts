import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const DB_PATH = process.env.DB_PATH ?? "./server/data/dosewise.db";

mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS medications (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  dosage        TEXT,
  frequency     TEXT,
  purpose       TEXT,
  category      TEXT,
  side_effects  TEXT,
  call_doctor   TEXT,
  schedule      TEXT,
  refills_left  INTEGER,
  created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_medications_user ON medications(user_id);

CREATE TABLE IF NOT EXISTS adherence_logs (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  medication_id  TEXT NOT NULL,
  date           TEXT NOT NULL,
  taken          INTEGER NOT NULL,
  created_at     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, medication_id, date)
);
CREATE INDEX IF NOT EXISTS idx_adherence_user_date ON adherence_logs(user_id, date);

CREATE TABLE IF NOT EXISTS risk_assessments (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  input_json  TEXT NOT NULL,
  result_json TEXT NOT NULL,
  score       INTEGER NOT NULL,
  level       TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_risk_user ON risk_assessments(user_id, created_at);

CREATE TABLE IF NOT EXISTS bills (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  raw_text   TEXT NOT NULL,
  items_json TEXT NOT NULL,
  total      REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_bills_user ON bills(user_id, created_at);

CREATE TABLE IF NOT EXISTS coupons (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  medication     TEXT NOT NULL,
  pharmacy       TEXT NOT NULL,
  original_price REAL NOT NULL,
  coupon_price   REAL NOT NULL,
  expires_on     TEXT NOT NULL,
  code           TEXT NOT NULL,
  source         TEXT NOT NULL,
  note           TEXT,
  saved          INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_coupons_user ON coupons(user_id);

CREATE TABLE IF NOT EXISTS companion_messages (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content     TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_companion_user ON companion_messages(user_id, created_at);
`;

db.exec(SCHEMA);

/** Kept for explicit re-initialization in tests; schema runs at module load. */
export function initDb() {
  db.exec(SCHEMA);
}

export function uid(prefix = ""): string {
  // 16 random bytes hex (32 chars), prefixed for readability
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  const hex = Array.from(buf, b => b.toString(16).padStart(2, "0")).join("");
  return prefix ? `${prefix}_${hex}` : hex;
}
