import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { copyFileSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDb } from '../src/db/client.ts';
import { seedDatabase } from '../src/db/seed.ts';
import { createReplitBackup, SNAPSHOT_NAME, SnapshotBackup, type SnapshotStore } from '../server/backup.ts';
import { NOW } from './helpers.ts';

/** Fake object storage backed by a temp folder. */
function fakeStore(dir: string, failUpload = false): SnapshotStore & { uploads: number } {
  const p = (n: string) => join(dir, `bucket-${n}`);
  const s = {
    uploads: 0,
    exists: async (n: string) => ({ ok: true, value: existsSync(p(n)) }),
    downloadToFilename: async (n: string, dest: string) => { copyFileSync(p(n), dest); return { ok: true }; },
    uploadFromFilename: async (n: string, src: string) => {
      if (failUpload) return { ok: false, error: new Error('quota') };
      copyFileSync(src, p(n));
      s.uploads++;
      return { ok: true };
    },
  };
  return s;
}

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'logta-backup-')); });
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('SnapshotBackup', () => {
  it('survives a "redeploy": snapshot, wipe the disk, restore on start', async () => {
    const dbPath = join(dir, 'data', 'logta.db');
    const store = fakeStore(dir);
    const backup = new SnapshotBackup(store, dbPath, () => {});
    expect(await backup.restoreIfMissing()).toBe('no-snapshot');

    const db = createDb(dbPath);
    seedDatabase(db, { now: NOW, webSnapshotPath: '__none__.json' });
    db.$client.prepare(`INSERT INTO users (display_name, device_id) VALUES ('Scanner', 'phone-x')`).run();
    expect(await backup.snapshot(db)).toBe('uploaded');
    expect(await backup.snapshot(db)).toBe('unchanged'); // nothing new → no upload
    expect(store.uploads).toBe(1);
    db.$client.close();

    // redeploy: local disk is gone
    rmSync(join(dir, 'data'), { recursive: true, force: true });
    const fresh = new SnapshotBackup(store, dbPath, () => {});
    expect(await fresh.restoreIfMissing()).toBe('restored');
    const db2 = createDb(dbPath);
    expect((db2.$client.prepare(`SELECT COUNT(*) n FROM users WHERE device_id = 'phone-x'`).get() as { n: number }).n).toBe(1);
    expect((db2.$client.prepare('SELECT COUNT(*) n FROM products').get() as { n: number }).n).toBe(147);
    db2.$client.close();
  });

  it('never overwrites an existing local database on start', async () => {
    const dbPath = join(dir, 'logta.db');
    writeFileSync(join(dir, `bucket-${SNAPSHOT_NAME}`), 'old snapshot');
    writeFileSync(dbPath, 'local');
    expect(await new SnapshotBackup(fakeStore(dir), dbPath, () => {}).restoreIfMissing()).toBe('kept-local');
  });

  it('reports upload failures without crashing and retries next time', async () => {
    const dbPath = join(dir, 'logta.db');
    const db = createDb(dbPath);
    const backup = new SnapshotBackup(fakeStore(dir, true), dbPath, () => {});
    expect(await backup.snapshot(db)).toBe('failed');
    expect(existsSync(`${dbPath}.snapshot`)).toBe(false); // temp file cleaned up
    db.$client.close();
  });

  it('is only enabled on Replit or when asked', async () => {
    expect(await createReplitBackup(join(dir, 'x.db'), {})).toBeNull();
    expect(await createReplitBackup(join(dir, 'x.db'), { REPL_ID: 'abc', LOGTA_BACKUP: 'off' })).toBeNull();
  });
});
