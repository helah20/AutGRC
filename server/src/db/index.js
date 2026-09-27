import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import config from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const db = new Database(config.dbFile);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

/**
 * Column migrations.
 *
 * schema.sql runs on every boot, but CREATE TABLE IF NOT EXISTS is a no-op
 * against a table that already exists, so a column added to an existing table
 * never reaches a database someone is already using. These are applied by
 * inspection instead: additive, idempotent, and safe to run on every start.
 * A column added here must also be added to schema.sql for fresh databases.
 */
const ADDED_COLUMNS = [
  // Multi-factor authentication on the platform itself.
  ['users', 'mfa_secret', 'TEXT'],
  ['users', 'mfa_enabled', 'INTEGER NOT NULL DEFAULT 0'],
  ['users', 'mfa_enrolled_at', 'TEXT'],
  ['users', 'mfa_recovery_codes', 'TEXT'],
  // Set when an administrator resets a password, cleared when the person picks
  // their own. While set, the session may do nothing but change it.
  ['users', 'must_change_password', 'INTEGER NOT NULL DEFAULT 0'],
  // Which roles may not sign in without a second factor.
  ['org_profile', 'mfa_required_roles', 'TEXT'],
  // Framework editions: a new release of a standard coexists with the one the
  // organisation is still certified against.
  ['frameworks', 'edition_status',
    "TEXT NOT NULL DEFAULT 'current' CHECK (edition_status IN ('current','superseded','draft'))"],
  ['frameworks', 'supersedes_id', 'TEXT'],
  ['frameworks', 'published_on', 'TEXT'],
  ['frameworks', 'retires_on', 'TEXT']
];

function applyColumnMigrations() {
  const applied = [];
  for (const [table, column, definition] of ADDED_COLUMNS) {
    const exists = db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);
    if (exists) continue;
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    applied.push(`${table}.${column}`);
  }
  return applied;
}

const migrated = applyColumnMigrations();
if (migrated.length) {
  console.log(`[AutGRC] Added ${migrated.length} column(s) to an existing database: ${migrated.join(', ')}`);
}

/** Convenience helpers so route code stays terse and consistent. */
export const q = {
  all: (sql, ...p) => db.prepare(sql).all(...p),
  get: (sql, ...p) => db.prepare(sql).get(...p),
  run: (sql, ...p) => db.prepare(sql).run(...p),
  tx: (fn) => db.transaction(fn)
};

export function nowIso() {
  return new Date().toISOString();
}

/** JSON columns are stored as text; these keep the call sites honest. */
export function toJson(value) {
  if (value === undefined || value === null) return null;
  return JSON.stringify(value);
}

export function fromJson(value, fallback = null) {
  if (value === undefined || value === null || value === '') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export default db;
