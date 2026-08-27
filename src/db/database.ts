/**
 * Application database opener — Expo production path and test helper.
 * Idempotent: open → enable FK → run migrations; safe to call again on same file.
 */

import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

import { createExpoSqliteAdapter } from './expoSqliteAdapter';
import { runMigrations } from './migrate';
import type { SqlDatabase } from './types';

/** On-device SQLite filename (lives in the app's document directory). */
export const APP_DATABASE_NAME = 'garden_diary.db';

/**
 * Opens the app database, enables foreign keys, and applies pending migrations.
 * Safe to call multiple times — migrations no-op when user_version is current.
 */
export function openAppDatabase(): SqlDatabase {
  const client = openDatabaseSync(APP_DATABASE_NAME);
  return createDatabaseFromClient(createExpoSqliteAdapter(client), client);
}

/**
 * Builds a ready SqlDatabase from an already-constructed adapter.
 * Used by tests (sql.js) and by openAppDatabase after wrapping expo-sqlite.
 */
export function createDatabaseFromClient(
  db: SqlDatabase,
  _rawClient?: SQLiteDatabase | unknown
): SqlDatabase {
  // Foreign keys are off by default in SQLite — must enable per connection.
  db.exec('PRAGMA foreign_keys = ON;');
  runMigrations(db);
  return db;
}

/**
 * Returns whether foreign_keys pragma is enabled on this connection.
 * Used by tests to prove FK enforcement is active.
 */
export function areForeignKeysEnabled(db: SqlDatabase): boolean {
  const row = db.getFirst<{ foreign_keys: number }>('PRAGMA foreign_keys');
  return (row?.foreign_keys ?? 0) === 1;
}
