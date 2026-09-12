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
