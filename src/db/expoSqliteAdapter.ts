/**
 * Adapts expo-sqlite SQLiteDatabase (sync API) to the SqlDatabase interface.
 */

import type { SQLiteDatabase } from 'expo-sqlite';

import { StorageError } from '@/src/domain/errors';
import type { SqlDatabase, SqlRunResult } from './types';

/**
 * Wraps an expo-sqlite sync database handle.
 */
export function createExpoSqliteAdapter(client: SQLiteDatabase): SqlDatabase {
  return {
    exec(sql: string): void {
      try {
        client.execSync(sql);
      } catch (err) {
        throw new StorageError(`exec failed: ${sql.slice(0, 80)}`, err);
      }
    },

    run(sql: string, params: unknown[] = []): SqlRunResult {
      try {
        const result = client.runSync(sql, params as (string | number | null)[]);
        return {
          changes: result.changes,
          lastInsertRowId: Number(result.lastInsertRowId),
        };
      } catch (err) {
        throw new StorageError(`run failed: ${sql.slice(0, 80)}`, err);
      }
    },

    getAll<T>(sql: string, params: unknown[] = []): T[] {
      try {
        return client.getAllSync(sql, params as (string | number | null)[]) as T[];
      } catch (err) {
        throw new StorageError(`getAll failed: ${sql.slice(0, 80)}`, err);
      }
    },

    getFirst<T>(sql: string, params: unknown[] = []): T | null {
      try {
        const row = client.getFirstSync(sql, params as (string | number | null)[]);
        return (row as T | null) ?? null;
      } catch (err) {
        throw new StorageError(`getFirst failed: ${sql.slice(0, 80)}`, err);
      }
    },

    withTransaction<T>(fn: () => T): T {
      try {
        let result!: T;
        client.withTransactionSync(() => {
          result = fn();
        });
        return result;
      } catch (err) {
        if (err instanceof StorageError) {
          throw err;
        }
        throw new StorageError('Transaction failed', err);
      }
    },

    getUserVersion(): number {
      const row = client.getFirstSync<{ user_version: number }>('PRAGMA user_version');
      return row?.user_version ?? 0;
    },

    setUserVersion(version: number): void {
      client.execSync(`PRAGMA user_version = ${Number(version)}`);
    },
  };
}
