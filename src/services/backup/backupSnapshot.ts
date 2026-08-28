/**
 * Reads a consistent SQLite snapshot for backup inside one transaction.
 */

import type { SqlDatabase } from '@/src/db/types';

import type { BackupTableSnapshot } from './backupTypes';

/** Table read order is irrelevant — all reads share one transaction snapshot. */
export function readBackupTableSnapshot(db: SqlDatabase): BackupTableSnapshot {
  return db.withTransaction(() => ({
    gardens: db.getAll('SELECT * FROM gardens ORDER BY created_at ASC'),
    seasons: db.getAll('SELECT * FROM seasons ORDER BY created_at ASC'),
    gardenAreas: db.getAll('SELECT * FROM garden_areas ORDER BY sort_order ASC'),
    plantCatalogItems: db.getAll(
      'SELECT * FROM plant_catalog_items ORDER BY created_at ASC'
    ),
    gardenPlants: db.getAll('SELECT * FROM garden_plants ORDER BY created_at ASC'),
    plantings: db.getAll('SELECT * FROM plantings ORDER BY created_at ASC'),
    gardenTasks: db.getAll('SELECT * FROM garden_tasks ORDER BY created_at ASC'),
    gardenEvents: db.getAll('SELECT * FROM garden_events ORDER BY created_at ASC'),
    harvests: db.getAll('SELECT * FROM harvests ORDER BY created_at ASC'),
    expenses: db.getAll('SELECT * FROM expenses ORDER BY created_at ASC'),
    gardenPhotos: db.getAll('SELECT * FROM garden_photos ORDER BY created_at ASC'),
    appSettings: db.getAll('SELECT * FROM app_settings ORDER BY key ASC'),
    photoFiles: {},
  }));
}
