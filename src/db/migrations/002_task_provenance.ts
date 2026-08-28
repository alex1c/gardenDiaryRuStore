/**
 * Migration 002 — task completion provenance for atomic undo.
 *
 * Adds nullable links on garden_tasks:
 * - completion_event_id → GardenEvent created when the task was completed
 * - spawned_task_id → next recurring occurrence created by that completion
 *
 * These columns enable idempotent completion and safe undo without orphan rows.
 */

import type { Migration, SqlDatabase } from '../types';

export const migration002TaskProvenance: Migration = {
  version: 2,
  name: '002_task_provenance',

  up(db: SqlDatabase): void {
    db.exec(`
      ALTER TABLE garden_tasks
      ADD COLUMN completion_event_id TEXT
      REFERENCES garden_events(id) ON DELETE SET NULL;
    `);

    db.exec(`
      ALTER TABLE garden_tasks
      ADD COLUMN spawned_task_id TEXT
      REFERENCES garden_tasks(id) ON DELETE SET NULL;
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_garden_tasks_season_active_due
      ON garden_tasks(season_id, due_date)
      WHERE completed_at IS NULL;
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_garden_events_season_date
      ON garden_events(season_id, event_date);
    `);
  },
};
