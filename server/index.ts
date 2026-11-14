/** `npm run server` — start the Logta API (see server/app.ts for routes and env vars). */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getDb } from '../src/db/client.ts';
import { seedDatabase, printSeedStats } from '../src/db/seed.ts';
import { createLlmClientFromEnv } from '../src/lib/llm-client.ts';
import { retryNeedsReview } from '../src/lib/pipeline.ts';
import { createApp, DEFAULT_ORIGINS } from './app.ts';

// Minimal .env loader (no dependency): KEY=value lines, existing env wins.
const envFile = resolve(process.cwd(), '.env');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && process.env[m[1]!] === undefined) process.env[m[1]!] = m[2]!.replace(/^['"]|['"]$/g, '');
  }
}

const db = getDb(); // opens + migrates data/logta.db
const empty = (db.$client.prepare('SELECT COUNT(*) AS n FROM products').get() as { n: number }).n === 0;
if (empty) {
  console.log('Empty database → seeding demo catalogue…');
  printSeedStats(seedDatabase(db));
}

const llm = createLlmClientFromEnv();
const origins = process.env.ALLOWED_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean) ?? DEFAULT_ORIGINS;
const app = createApp({ llm, allowedOrigins: origins, adminToken: process.env.ADMIN_TOKEN || undefined });
const port = Number(process.env.PORT ?? 8787);
app.listen(port, () => {
  console.log(`Logta API on http://localhost:${port}  ·  AI: ${llm?.name ?? 'NOT CONFIGURED (scans return 503)'}  ·  origins: ${origins.join(', ')}`);
});

// The AI keeps working between scans: finish lines left unresolved (e.g. provider outage) and promote ready items.
if (llm) {
  setInterval(() => {
    retryNeedsReview({ llm, limit: 25 })
      .then((r) => {
        if (r.resolved || r.autoPromoted.length) console.log(`[retry] resolved ${r.resolved} (${r.viaAlias} via learned aliases), promoted ${r.autoPromoted.length}`);
      })
      .catch((e) => console.error('[retry] failed', e));
  }, 5 * 60_000).unref();
}
