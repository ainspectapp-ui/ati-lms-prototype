/** Apply Drizzle migrations to the SQLite database. */
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '../server/db.ts';

migrate(db, { migrationsFolder: './db/migrations' });
console.log('✓ migrations applied');
