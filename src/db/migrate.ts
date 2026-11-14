/** `npm run db:migrate` — apply pending Drizzle migrations to the SQLite file. */
import { createDb, DEFAULT_DB_PATH } from './client.ts';

const db = createDb(DEFAULT_DB_PATH);
console.log(`Migrations applied to ${DEFAULT_DB_PATH}`);
db.$client.close();
