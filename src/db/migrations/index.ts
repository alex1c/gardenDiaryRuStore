/**
 * Ordered list of schema migrations and the current target schema version.
 */

import { migration001Initial } from './001_initial';
import { migration002TaskProvenance } from './002_task_provenance';
import type { Migration } from '../types';

/** All forward migrations in ascending version order. */
export const MIGRATIONS: readonly Migration[] = [
  migration001Initial,
  migration002TaskProvenance,
];

/** Highest schema version this app build knows how to apply. */
export const CURRENT_SCHEMA_VERSION = 2;
