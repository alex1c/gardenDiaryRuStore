/**
 * Atomically replaces current database content from a validated backup v1.
 */

import type { SqlDatabase } from '@/src/db/types';
import { StorageError } from '@/src/domain/errors';

import type {
  BackupPhotoWriter,
  BackupTableSnapshot,
  GardenDiaryBackupV1,
} from './backupTypes';

/** Child-first delete order respecting FK dependencies. */
const CLEAR_TABLES = [
  'garden_photos',
  'harvests',
  'expenses',
  'garden_events',
  'garden_tasks',
  'plantings',
  'garden_plants',
  'plant_catalog_items',
  'garden_areas',
  'seasons',
  'gardens',
  'app_settings',
] as const;

type StagedPhoto = {
  photoId: string;
  uri: string;
};

/**
 * Replaces all user data with backup contents inside one SQLite transaction.
 * Photo binaries are staged on disk before the transaction begins.
 */
export async function restoreBackupV1(
  db: SqlDatabase,
  backup: GardenDiaryBackupV1,
  photoWriter: BackupPhotoWriter
): Promise<void> {
  const stagedPhotos = await stagePhotoFiles(backup.data, photoWriter);

  try {
    db.withTransaction(() => {
      clearAllTables(db);
      insertAllData(db, backup.data, stagedPhotos);
    });
  } catch (err) {
    await rollbackStagedPhotos(stagedPhotos, photoWriter);
    throw new StorageError('Не удалось восстановить данные', err);
  }
}

async function stagePhotoFiles(
  data: BackupTableSnapshot,
  writer: BackupPhotoWriter
): Promise<Map<string, StagedPhoto>> {
  const staged = new Map<string, StagedPhoto>();

  for (const row of data.gardenPhotos) {
    const photoId = String(row.id);
    const file = data.photoFiles[photoId];
    if (!file) {
      continue;
    }
    const uri = await writer.writePhotoFile(photoId, file);
    staged.set(photoId, { photoId, uri });
  }

  return staged;
}

async function rollbackStagedPhotos(
  staged: Map<string, StagedPhoto>,
  writer: BackupPhotoWriter
): Promise<void> {
  for (const item of staged.values()) {
    await writer.deletePhotoFile(item.uri);
  }
}

function clearAllTables(db: SqlDatabase): void {
  for (const table of CLEAR_TABLES) {
    db.run(`DELETE FROM ${table}`);
  }
}

function insertAllData(
  db: SqlDatabase,
  data: BackupTableSnapshot,
  stagedPhotos: Map<string, StagedPhoto>
): void {
  insertRows(db, 'gardens', data.gardens, [
    'id',
    'name',
    'location_name',
    'notes',
    'created_at',
    'updated_at',
  ]);
  insertRows(db, 'seasons', data.seasons, [
    'id',
    'garden_id',
    'year',
    'title',
    'start_date',
    'end_date',
    'archived',
    'created_at',
    'updated_at',
  ]);
  insertRows(db, 'garden_areas', data.gardenAreas, [
    'id',
    'garden_id',
    'name',
    'type',
    'length',
    'width',
    'notes',
    'sort_order',
    'created_at',
    'updated_at',
  ]);
  insertRows(db, 'plant_catalog_items', data.plantCatalogItems, [
    'id',
    'garden_id',
    'species_name',
    'variety_name',
    'notes',
    'created_at',
    'updated_at',
  ]);
  insertRows(db, 'garden_plants', data.gardenPlants, [
    'id',
    'garden_id',
    'area_id',
    'catalog_item_id',
    'name',
    'quantity',
    'quantity_unit',
    'planted_date',
    'status',
    'notes',
    'created_at',
    'updated_at',
  ]);
  insertRows(db, 'plantings', data.plantings, [
    'id',
    'season_id',
    'area_id',
    'catalog_item_id',
    'garden_plant_id',
    'quantity',
    'quantity_unit',
    'sowing_date',
    'transplant_date',
    'harvest_start_date',
    'status',
    'notes',
    'created_at',
    'updated_at',
  ]);

  // Tasks first without deferred FK columns that reference events.
  insertRows(
    db,
    'garden_tasks',
    data.gardenTasks,
    [
      'id',
      'season_id',
      'area_id',
      'planting_id',
      'type',
      'title',
      'due_date',
      'completed_at',
      'repeat_type',
      'repeat_interval',
      'notes',
      'created_at',
      'updated_at',
    ],
    (row) => ({
      ...row,
      completion_event_id: null,
      spawned_task_id: null,
    })
  );

  insertRows(db, 'garden_events', data.gardenEvents, [
    'id',
    'season_id',
    'area_id',
    'planting_id',
    'task_id',
    'type',
    'title',
    'event_date',
    'notes',
    'created_at',
    'updated_at',
  ]);

  for (const row of data.gardenTasks) {
    const completion = row.completion_event_id ?? null;
    const spawned = row.spawned_task_id ?? null;
    if (completion || spawned) {
      db.run(
        `UPDATE garden_tasks
         SET completion_event_id = ?, spawned_task_id = ?
         WHERE id = ?`,
        [completion, spawned, row.id]
      );
    }
  }

  insertRows(db, 'harvests', data.harvests, [
    'id',
    'season_id',
    'planting_id',
    'event_id',
    'date',
    'quantity',
    'unit',
    'notes',
    'created_at',
    'updated_at',
  ]);
  insertRows(db, 'expenses', data.expenses, [
    'id',
    'season_id',
    'area_id',
    'planting_id',
    'date',
    'category',
    'amount_kopecks',
    'notes',
    'created_at',
    'updated_at',
  ]);

  const photoRows = data.gardenPhotos.map((row) => {
    const id = String(row.id);
    const staged = stagedPhotos.get(id);
    return staged ? { ...row, uri: staged.uri } : row;
  });
  insertRows(db, 'garden_photos', photoRows, [
    'id',
    'garden_id',
    'season_id',
    'area_id',
    'planting_id',
    'event_id',
    'uri',
    'taken_at',
    'caption',
    'created_at',
  ]);

  insertRows(db, 'app_settings', data.appSettings, ['key', 'value', 'updated_at']);
}

function insertRows(
  db: SqlDatabase,
  table: string,
  rows: Record<string, unknown>[],
  columns: string[],
  mapRow?: (row: Record<string, unknown>) => Record<string, unknown>
): void {
  if (rows.length === 0) {
    return;
  }

  const placeholders = columns.map(() => '?').join(', ');
  const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;

  for (const source of rows) {
    const row = mapRow ? mapRow(source) : source;
    const values = columns.map((column) => row[column] ?? null);
    db.run(sql, values);
  }
}
