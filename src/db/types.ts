/**
 * Abstract SQL database interface used by migrations and repositories.
 * Implementations: expoSqliteAdapter (device), sqlJsAdapter (tests).
 */

/** Result of a mutating statement (INSERT / UPDATE / DELETE). */
export type SqlRunResult = {
  changes: number;
  lastInsertRowId: number;
};

/**
 * Thin, sync-friendly SQLite façade.
 * Synchronous to match expo-sqlite openDatabaseSync and sql.js.
 */
export interface SqlDatabase {
  exec(sql: string): void;
  run(sql: string, params?: unknown[]): SqlRunResult;
  getAll<T>(sql: string, params?: unknown[]): T[];
  getFirst<T>(sql: string, params?: unknown[]): T | null;
  withTransaction<T>(fn: () => T): T;
  getUserVersion(): number;
  setUserVersion(version: number): void;
}

/** A numbered forward-only migration. */
export interface Migration {
  version: number;
  name: string;
  up: (db: SqlDatabase) => void;
}
