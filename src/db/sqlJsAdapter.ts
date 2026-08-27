/**
 * sql.js adapter used ONLY in Jest / Node tests.
 */

import type { Database as SqlJsDatabase, Statement } from 'sql.js';

import { StorageError } from '@/src/domain/errors';
import type { SqlDatabase, SqlRunResult } from './types';

/**
 * Wraps a sql.js Database to implement SqlDatabase.
 */
export function createSqlJsAdapter(client: SqlJsDatabase): SqlDatabase {
  const adapter: SqlDatabase = {
    exec(sql: string): void {
      try {
        client.exec(sql);
      } catch (err) {
        throw new StorageError(`sql.js exec failed: ${sql.slice(0, 80)}`, err);
      }
    },

    run(sql: string, params: unknown[] = []): SqlRunResult {
      let stmt: Statement | null = null;
      try {
        stmt = client.prepare(sql);
        stmt.bind(normalizeParams(params));
        stmt.step();
        stmt.free();
        stmt = null;

        return {
          changes: client.getRowsModified(),
          lastInsertRowId: readLastInsertRowId(client),
        };
      } catch (err) {
        if (stmt) {
          try {
            stmt.free();
          } catch {
            // Ignore free errors while propagating the original failure.
          }
        }
        throw new StorageError(`sql.js run failed: ${sql.slice(0, 80)}`, err);
      }
    },

    getAll<T>(sql: string, params: unknown[] = []): T[] {
      let stmt: Statement | null = null;
      try {
        stmt = client.prepare(sql);
        stmt.bind(normalizeParams(params));
        const rows: T[] = [];
        while (stmt.step()) {
          rows.push(stmt.getAsObject() as T);
        }
        stmt.free();
        stmt = null;
        return rows;
      } catch (err) {
        if (stmt) {
          try {
            stmt.free();
          } catch {
            // Ignore free errors while propagating the original failure.
          }
        }
        throw new StorageError(`sql.js getAll failed: ${sql.slice(0, 80)}`, err);
      }
    },

    getFirst<T>(sql: string, params: unknown[] = []): T | null {
      const rows = adapter.getAll<T>(sql, params);
      return rows.length > 0 ? rows[0] : null;
    },

    withTransaction<T>(fn: () => T): T {
      try {
        client.run('BEGIN');
        const result = fn();
        client.run('COMMIT');
        return result;
      } catch (err) {
        try {
          client.run('ROLLBACK');
        } catch (rollbackErr) {
          throw new StorageError('Transaction rollback failed', {
            original: err,
            rollback: rollbackErr,
          });
        }
        if (err instanceof StorageError) {
          throw err;
        }
        throw new StorageError('sql.js transaction failed', err);
      }
    },

    getUserVersion(): number {
      const result = client.exec('PRAGMA user_version');
      const value = result[0]?.values?.[0]?.[0];
      return typeof value === 'number' ? value : Number(value ?? 0);
    },

    setUserVersion(version: number): void {
      client.run(`PRAGMA user_version = ${Number(version)}`);
    },
  };

  return adapter;
}

function normalizeParams(params: unknown[]): (string | number | null | Uint8Array)[] {
  return params.map((p) => {
    if (p === undefined) return null;
    if (p === null || typeof p === 'string' || typeof p === 'number') return p;
    if (typeof p === 'boolean') return p ? 1 : 0;
    if (p instanceof Uint8Array) return p;
    return String(p);
  });
}

function readLastInsertRowId(client: SqlJsDatabase): number {
  const result = client.exec('SELECT last_insert_rowid() AS id');
  const value = result[0]?.values?.[0]?.[0];
  return typeof value === 'number' ? value : Number(value ?? 0);
}
