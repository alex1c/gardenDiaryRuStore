/**
 * Applies pending numbered migrations using SQLite PRAGMA user_version.
 * Each migration runs inside its own transaction; version is bumped after success.
 */

import { StorageError } from '@/src/domain/errors';
import { MIGRATIONS } from './migrations';
import type { SqlDatabase } from './types';

/**
 * Runs all migrations with version > current user_version, in order.
 * Idempotent: calling again when already up-to-date is a no-op.
 */
export function runMigrations(db: SqlDatabase): void {
  const current = db.getUserVersion();

  for (const migration of MIGRATIONS) {
    if (migration.version <= current) {
      continue;
    }

    try {
      db.withTransaction(() => {
        migration.up(db);
        // Bump user_version inside the same transaction so a failed up() rolls back.
        db.setUserVersion(migration.version);
      });
    } catch (err) {
      throw new StorageError(
        `Migration ${migration.version} (${migration.name}) failed`,
        err
      );
    }
  }
}
