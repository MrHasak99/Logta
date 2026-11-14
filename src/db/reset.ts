/** `npm run db:reset` — drop the SQLite file, run migrations, seed. */
import { rmSync } from 'node:fs';
import { createDb, DEFAULT_DB_PATH } from './client.ts';
import { printSeedStats, seedDatabase } from './seed.ts';

for (const suffix of ['', '-wal', '-shm']) rmSync(DEFAULT_DB_PATH + suffix, { force: true });
console.log(`Dropped ${DEFAULT_DB_PATH}`);
const db = createDb(DEFAULT_DB_PATH); // runs migrations
console.log('Migrated');
printSeedStats(seedDatabase(db));
db.$client.close();
