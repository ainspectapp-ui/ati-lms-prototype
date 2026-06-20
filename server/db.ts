/** Drizzle database client (SQLite via better-sqlite3). */
import 'dotenv/config';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema.ts';

// Resolve relative to the project root (this file), not the process cwd, so the
// DB is found no matter where the server is launched from.
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const url = process.env.DATABASE_URL ?? resolve(projectRoot, 'data', 'lms.db');
mkdirSync(dirname(url), { recursive: true });

const sqlite = new Database(url);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });
export { schema };
