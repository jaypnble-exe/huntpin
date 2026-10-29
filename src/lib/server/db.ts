import "server-only";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

// Local development store (Node's built-in SQLite, no extra dependency).
// It only holds app-owned data: usage events and settings. It does not persist
// on serverless hosts; replace with Supabase before deploying.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS usage_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  request_count INTEGER NOT NULL,
  sku_if_known TEXT,
  status TEXT NOT NULL CHECK (status IN ('reserved', 'success', 'failure')),
  error_category TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT
);
CREATE INDEX IF NOT EXISTS usage_events_created_at ON usage_events (created_at);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;

export function openDatabase(file: string): DatabaseSync {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
  db.exec(SCHEMA);
  return db;
}

// Reuse one connection across dev-server hot reloads.
const globalForDb = globalThis as { __clientFinderDb?: DatabaseSync };

export function getDatabase(): DatabaseSync {
  globalForDb.__clientFinderDb ??= openDatabase(
    process.env.DATABASE_PATH?.trim() ||
      path.join(process.cwd(), "data", "clientfinder.db"),
  );
  return globalForDb.__clientFinderDb;
}
