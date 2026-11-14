/** `npm run server` — start the Logta API (see server/app.ts for routes, docs/DEPLOY_REPLIT.md for hosting). */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createDb, setDb } from '../src/db/client.ts';
import { seedDatabase, printSeedStats } from '../src/db/seed.ts';
import { createLlmClientFromEnv } from '../src/lib/llm-client.ts';
import { retryNeedsReview } from '../src/lib/pipeline.ts';
import { createApp, DEFAULT_ORIGINS } from './app.ts';
import { createReplitBackup } from './backup.ts';

// Minimal .env loader (no dependency): KEY=value lines; real env vars (e.g. Replit Secrets) win.
const envFile = resolve(process.cwd(), '.env');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && m[2] && process.env[m[1]!] === undefined) process.env[m[1]!] = m[2].replace(/^['"]|['"]$/g, '');
  }
}

// Resolved after .env is loaded (so LOGTA_DB_PATH from .env is honoured).
const dbPath = resolve(process.cwd(), process.env.LOGTA_DB_PATH ?? 'data/logta.db');
const SNAPSHOT_EVERY_MS = 3 * 60_000;

async function main() {
  // 1. On hosts that wipe the disk on deploy, pull the last snapshot before opening the DB.
  const backup = await createReplitBackup(dbPath);
  if (backup) console.log(`[backup] object storage snapshots enabled → ${await backup.restoreIfMissing()}`);

  // 2. Open + migrate; seed the demo catalogue only into an empty database.
  const db = createDb(dbPath);
  setDb(db);
  const empty = (db.$client.prepare('SELECT COUNT(*) AS n FROM products').get() as { n: number }).n === 0;
  if (empty) {
    console.log('Empty database → seeding demo catalogue…');
    printSeedStats(seedDatabase(db));
    if (backup) await backup.snapshot(db, { force: true });
  }

  // 3. Serve.
  const llm = createLlmClientFromEnv();
  const origins = process.env.ALLOWED_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean) ?? DEFAULT_ORIGINS;
  const app = createApp({ db, llm, allowedOrigins: origins, adminToken: process.env.ADMIN_TOKEN || undefined });
  const port = Number(process.env.PORT ?? 8787);
  app.listen(port, () => {
    console.log(`Logta API on port ${port}  ·  DB: ${dbPath}  ·  AI: ${llm?.name ?? 'NOT CONFIGURED (scans return 503)'}  ·  backup: ${backup ? 'object storage' : 'off'}  ·  origins: ${origins.join(', ')}`);
  });

  // 4. The AI keeps working between scans: finish lines left unresolved (e.g. provider outage), promote ready items.
  if (llm) {
    setInterval(() => {
      retryNeedsReview({ llm, limit: 25 })
        .then((r) => {
          if (r.resolved || r.autoPromoted.length) console.log(`[retry] resolved ${r.resolved} (${r.viaAlias} via learned aliases), promoted ${r.autoPromoted.length}`);
        })
        .catch((e) => console.error('[retry] failed', e));
    }, 5 * 60_000).unref();
  }

  // 5. Snapshots: periodically (only when changed) and once more on shutdown/redeploy.
  if (backup) {
    setInterval(() => void backup.snapshot(db), SNAPSHOT_EVERY_MS).unref();
    let stopping = false;
    const shutdown = async (signal: string) => {
      if (stopping) return;
      stopping = true;
      console.log(`[backup] ${signal}: final snapshot → ${await backup.snapshot(db, { force: true })}`);
      app.close();
      process.exit(0);
    };
    process.on('SIGTERM', () => void shutdown('SIGTERM'));
    process.on('SIGINT', () => void shutdown('SIGINT'));
  }
}

main().catch((e) => {
  console.error('Failed to start Logta API', e);
  process.exit(1);
});
