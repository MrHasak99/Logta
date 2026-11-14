/**
 * SQLite ⇄ object storage snapshots, so the database survives redeploys on hosts whose filesystem is
 * wiped on deploy (Replit Deployments: "Any data saved to the filesystem will not persist after redeploying").
 *
 *   start:    if the DB file is missing and a snapshot exists → download it before opening the DB
 *   running:  snapshot every few minutes (only if something changed) using SQLite's online backup API
 *   shutdown: final snapshot on SIGTERM/SIGINT
 *
 * Enabled automatically on Replit (REPL_ID is set) or with LOGTA_BACKUP=replit; LOGTA_BACKUP=off disables it.
 * Requires an Object Storage bucket created in the Replit workspace (Tools → Object Storage).
 */
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';
import type { DB } from '../src/db/client.ts';

/** The subset of @replit/object-storage's Client we use (so tests can pass a fake). */
export interface SnapshotStore {
  exists(name: string): Promise<{ ok: boolean; value?: boolean; error?: unknown }>;
  downloadToFilename(name: string, dest: string): Promise<{ ok: boolean; error?: unknown }>;
  uploadFromFilename(name: string, src: string): Promise<{ ok: boolean; error?: unknown }>;
}

export const SNAPSHOT_NAME = 'logta.db';

export class SnapshotBackup {
  private lastChanges = -1;
  constructor(
    private store: SnapshotStore,
    private dbPath: string,
    private log: (msg: string) => void = (m) => console.log(m),
  ) {}

  /** Download the latest snapshot if the local DB file doesn't exist yet. Returns what happened. */
  async restoreIfMissing(): Promise<'restored' | 'kept-local' | 'no-snapshot' | 'failed'> {
    if (existsSync(this.dbPath)) return 'kept-local';
    try {
      const ex = await this.store.exists(SNAPSHOT_NAME);
      if (!ex.ok) throw ex.error ?? new Error('exists() failed');
      if (!ex.value) return 'no-snapshot';
      mkdirSync(dirname(this.dbPath), { recursive: true });
      const dl = await this.store.downloadToFilename(SNAPSHOT_NAME, this.dbPath);
      if (!dl.ok) throw dl.error ?? new Error('download failed');
      this.log(`[backup] restored database from object storage (${SNAPSHOT_NAME})`);
      return 'restored';
    } catch (e) {
      rmSync(this.dbPath, { force: true }); // never start from a half-downloaded file
      this.log(`[backup] restore failed, starting fresh: ${e instanceof Error ? e.message : String(e)}`);
      return 'failed';
    }
  }

  /** Consistent online snapshot → upload. Skips when nothing changed since the last snapshot (unless forced). */
  async snapshot(db: DB, opts: { force?: boolean } = {}): Promise<'uploaded' | 'unchanged' | 'failed'> {
    const changes = (db.$client.prepare('SELECT total_changes() AS n').get() as { n: number }).n;
    if (!opts.force && changes === this.lastChanges) return 'unchanged';
    const tmp = `${this.dbPath}.snapshot`;
    try {
      rmSync(tmp, { force: true });
      await db.$client.backup(tmp);
      const up = await this.store.uploadFromFilename(SNAPSHOT_NAME, tmp);
      if (!up.ok) throw up.error ?? new Error('upload failed');
      this.lastChanges = changes;
      return 'uploaded';
    } catch (e) {
      this.log(`[backup] snapshot failed: ${e instanceof Error ? e.message : String(e)}`);
      return 'failed';
    } finally {
      rmSync(tmp, { force: true });
    }
  }
}

/** Build the Replit Object Storage backup if enabled and available, else null. */
export async function createReplitBackup(dbPath: string, env: Record<string, string | undefined> = process.env): Promise<SnapshotBackup | null> {
  const mode = env.LOGTA_BACKUP?.trim().toLowerCase();
  if (mode === 'off' || (!env.REPL_ID && mode !== 'replit')) return null;
  try {
    const { Client } = await import('@replit/object-storage');
    return new SnapshotBackup(new Client() as unknown as SnapshotStore, dbPath);
  } catch (e) {
    console.warn(`[backup] Replit Object Storage unavailable (${e instanceof Error ? e.message : String(e)}); data will not survive redeploys`);
    return null;
  }
}
