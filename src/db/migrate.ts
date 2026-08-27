/**
 * Applies pending numbered migrations using SQLite PRAGMA user_version.
 * Each migration runs inside its own transaction; version is bumped after success.
 */

import { StorageError } from '@/src/domain/errors';
import { MIGRATIONS } from './migrations';
import type { Migration, SqlDatabase } from './types';

/**
 * Runs all migrations with version > current user_version, in order.
 * Idempotent: calling again when already up-to-date is a no-op.
 */
export function runMigrations(
  db: SqlDatabase,
  migrations: readonly Migration[] = MIGRATIONS
): void {
  const current = db.getUserVersion();
  validateMigrationChain(migrations);
  const target = migrations.at(-1)?.version ?? 0;

  if (current > target) {
    throw new StorageError(
      `Database schema version ${current} is newer than supported version ${target}`
    );
  }

  for (const migration of migrations) {
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

function validateMigrationChain(migrations: readonly Migration[]): void {
  migrations.forEach((migration, index) => {
    const expected = index + 1;
    if (!Number.isInteger(migration.version) || migration.version !== expected) {
      throw new StorageError(
        `Invalid migration chain: expected version ${expected}, got ${migration.version}`
      );
    }
  });
}
