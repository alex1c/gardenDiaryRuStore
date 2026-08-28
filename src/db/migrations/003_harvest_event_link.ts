/**
 * Migration 003 — links harvest records to auto-generated diary events.
 *
 * harvests.event_id → garden_events(id) enables atomic create/edit/delete
 * and keeps the diary timeline in sync with harvest quantities.
 */

import type { Migration, SqlDatabase } from '../types';

export const migration003HarvestEventLink: Migration = {
  version: 3,
  name: '003_harvest_event_link',

  up(db: SqlDatabase): void {
    db.exec(`
      ALTER TABLE harvests
      ADD COLUMN event_id TEXT
      REFERENCES garden_events(id) ON DELETE SET NULL;
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_harvests_event_id
      ON harvests(event_id);
    `);
  },
};
