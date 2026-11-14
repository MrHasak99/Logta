/**
 * DB client. One SQLite file (default `data/logta.db`, override with LOGTA_DB_PATH).
 *
 * Services call `getDb()`; tests and scripts can swap the active DB with `setDb()`
 * (e.g. an in-memory DB built by `createDb(':memory:')`).
 */
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import * as schema from './schema.ts';

export type DB = BetterSQLite3Database<typeof schema> & { $client: Database.Database };

export const DEFAULT_DB_PATH = process.env.LOGTA_DB_PATH ?? resolve(process.cwd(), 'data', 'logta.db');
export const MIGRATIONS_FOLDER = resolve(process.cwd(), 'drizzle');

/** Open (and migrate) a DB. Pass ':memory:' for tests. */
export function createDb(path: string = DEFAULT_DB_PATH, opts: { migrate?: boolean } = {}): DB {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const sqlite = new Database(path);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema }) as DB;
  if (opts.migrate !== false) migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return db;
}

let current: DB | null = null;

export function getDb(): DB {
  if (!current) current = createDb();
  return current;
}

export function setDb(db: DB | null): void {
  current = db;
}

export { schema };
