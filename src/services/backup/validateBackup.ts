/**
 * Validates backup JSON before any destructive restore operation.
 */

import {
  EXPENSE_CATEGORIES,
  HARVEST_UNITS,
  PLANTING_STATUSES,
  REPEAT_TYPES,
  WORK_TYPES,
} from '@/src/domain/codes';
import { isValidLocalDateString } from '@/src/utils/localDate';

import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  type BackupPreview,
  type GardenDiaryBackupV1,
  type ParsedBackup,
} from './backupTypes';

const TABLE_KEYS = [
  'gardens',
  'seasons',
  'gardenAreas',
  'plantCatalogItems',
  'gardenPlants',
  'plantings',
  'gardenTasks',
  'gardenEvents',
  'harvests',
  'expenses',
  'gardenPhotos',
  'appSettings',
  'photoFiles',
] as const;

/** Parses JSON text and validates backup v1 structure and references. */
export function parseAndValidateBackupJson(text: string): ParsedBackup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return fail('invalid_json', 'Не удалось прочитать файл');
  }
  return validateBackupObject(raw);
}

export function validateBackupObject(raw: unknown): ParsedBackup {
  if (!raw || typeof raw !== 'object') {
    return fail('corrupted', 'Резервная копия повреждена');
  }

  const obj = raw as Record<string, unknown>;
  if (obj.format !== BACKUP_FORMAT) {
    return fail('wrong_format', 'Файл не является резервной копией «Моей дачи»');
  }

  const version = obj.version;
  if (typeof version !== 'number') {
    return fail('corrupted', 'Резервная копия повреждена');
  }
  if (version > BACKUP_VERSION) {
    return fail(
      'unsupported_version',
      'Эта резервная копия создана более новой версией приложения.'
    );
  }
  if (version !== BACKUP_VERSION) {
    return fail('wrong_format', 'Файл не является резервной копией «Моей дачи»');
  }

  if (typeof obj.createdAt !== 'string' || !obj.createdAt) {
    return fail('corrupted', 'Резервная копия повреждена');
  }

  const data = obj.data;
  if (!data || typeof data !== 'object') {
    return fail('corrupted', 'Резервная копия повреждена');
  }

  const dataObj = data as Record<string, unknown>;
  for (const key of TABLE_KEYS) {
    const value = dataObj[key];
    if (key === 'photoFiles') {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return fail('corrupted', 'Резервная копия повреждена');
      }
      continue;
    }
    if (!Array.isArray(value)) {
      return fail('corrupted', 'Резервная копия повреждена');
    }
  }

  const backup = obj as unknown as GardenDiaryBackupV1;
  try {
    const entityError = validateEntities(backup);
    if (entityError) {
      return fail('corrupted', entityError);
    }
  } catch {
    return fail('corrupted', 'Резервная копия повреждена');
  }

  return {
    ok: true,
    backup,
    preview: buildPreview(backup),
  };
}

function validateEntities(backup: GardenDiaryBackupV1): string | null {
  const ids = {
    gardens: collectIds(backup.data.gardens),
    seasons: collectIds(backup.data.seasons),
    areas: collectIds(backup.data.gardenAreas),
    catalog: collectIds(backup.data.plantCatalogItems),
    gardenPlants: collectIds(backup.data.gardenPlants),
    plantings: collectIds(backup.data.plantings),
    tasks: collectIds(backup.data.gardenTasks),
    events: collectIds(backup.data.gardenEvents),
    harvests: collectIds(backup.data.harvests),
    expenses: collectIds(backup.data.expenses),
    photos: collectIds(backup.data.gardenPhotos),
  };

  const seasonYearPairs = new Set<string>();
  for (const row of backup.data.seasons) {
    const gardenId = reqString(row, 'garden_id');
    if (!ids.gardens.has(gardenId)) {
      return 'Сезон ссылается на отсутствующий участок';
    }
    const year = row.year;
    if (typeof year !== 'number' || !Number.isInteger(year)) {
      return 'Некорректный год сезона';
    }
    const key = `${gardenId}:${year}`;
    if (seasonYearPairs.has(key)) {
      return 'Дублирующийся сезон для одного участка и года';
    }
    seasonYearPairs.add(key);
  }

  for (const row of backup.data.gardens) {
    reqString(row, 'name');
    reqString(row, 'created_at');
    reqString(row, 'updated_at');
  }

  for (const row of backup.data.gardenAreas) {
    if (!ids.gardens.has(reqString(row, 'garden_id'))) {
      return 'Зона ссылается на отсутствующий участок';
    }
    reqString(row, 'name');
    reqString(row, 'type');
  }

  for (const row of backup.data.plantCatalogItems) {
    if (!ids.gardens.has(reqString(row, 'garden_id'))) {
      return 'Каталог ссылается на отсутствующий участок';
    }
    reqString(row, 'species_name');
  }

  for (const row of backup.data.gardenPlants) {
    if (!ids.gardens.has(reqString(row, 'garden_id'))) {
      return 'Многолетник ссылается на отсутствующий участок';
    }
    if (!ids.catalog.has(reqString(row, 'catalog_item_id'))) {
      return 'Многолетник ссылается на отсутствующую культуру';
    }
    if (row.area_id != null && !ids.areas.has(String(row.area_id))) {
      return 'Многолетник ссылается на отсутствующую зону';
    }
    assertEnum(row.status, PLANTING_STATUSES, 'status');
  }

  const plantingPerennialKey = new Set<string>();
  for (const row of backup.data.plantings) {
    const seasonId = reqString(row, 'season_id');
    if (!ids.seasons.has(seasonId)) {
      return 'Посадка ссылается на отсутствующий сезон';
    }
    if (!ids.catalog.has(reqString(row, 'catalog_item_id'))) {
      return 'Посадка ссылается на отсутствующую культуру';
    }
    if (row.area_id != null && !ids.areas.has(String(row.area_id))) {
      return 'Посадка ссылается на отсутствующую зону';
    }
    if (row.garden_plant_id != null) {
      const gp = String(row.garden_plant_id);
      if (!ids.gardenPlants.has(gp)) {
        return 'Посадка ссылается на отсутствующий многолетник';
      }
      const key = `${seasonId}:${gp}`;
      if (plantingPerennialKey.has(key)) {
        return 'Дублирующаяся посадка многолетника в одном сезоне';
      }
      plantingPerennialKey.add(key);
    }
    assertEnum(row.status, PLANTING_STATUSES, 'status');
    assertOptionalLocalDate(row.sowing_date);
    assertOptionalLocalDate(row.transplant_date);
    assertOptionalLocalDate(row.harvest_start_date);
    assertOptionalPositive(row.quantity);
  }

  for (const row of backup.data.gardenTasks) {
    if (!ids.seasons.has(reqString(row, 'season_id'))) {
      return 'Задача ссылается на отсутствующий сезон';
    }
    assertOptionalFk(row.area_id, ids.areas);
    assertOptionalFk(row.planting_id, ids.plantings);
    assertOptionalFk(row.completion_event_id, ids.events);
    assertOptionalFk(row.spawned_task_id, ids.tasks);
    assertEnum(row.type, WORK_TYPES, 'type');
    assertEnum(row.repeat_type, REPEAT_TYPES, 'repeat_type');
    reqString(row, 'title');
    assertLocalDate(row.due_date, 'due_date');
  }

  for (const row of backup.data.gardenEvents) {
    if (!ids.seasons.has(reqString(row, 'season_id'))) {
      return 'Запись ссылается на отсутствующий сезон';
    }
    assertOptionalFk(row.area_id, ids.areas);
    assertOptionalFk(row.planting_id, ids.plantings);
    assertOptionalFk(row.task_id, ids.tasks);
    assertEnum(row.type, WORK_TYPES, 'type');
    reqString(row, 'title');
    assertLocalDate(row.event_date, 'event_date');
  }

  for (const row of backup.data.harvests) {
    if (!ids.seasons.has(reqString(row, 'season_id'))) {
      return 'Урожай ссылается на отсутствующий сезон';
    }
    if (!ids.plantings.has(reqString(row, 'planting_id'))) {
      return 'Урожай ссылается на отсутствующую посадку';
    }
    assertOptionalFk(row.event_id, ids.events);
    assertLocalDate(row.date, 'date');
    assertPositiveNumber(row.quantity, 'quantity');
    assertEnum(row.unit, HARVEST_UNITS, 'unit');
  }

  for (const row of backup.data.expenses) {
    if (!ids.seasons.has(reqString(row, 'season_id'))) {
      return 'Расход ссылается на отсутствующий сезон';
    }
    assertOptionalFk(row.area_id, ids.areas);
    assertOptionalFk(row.planting_id, ids.plantings);
    assertLocalDate(row.date, 'date');
    assertEnum(row.category, EXPENSE_CATEGORIES, 'category');
    const kopecks = row.amount_kopecks;
    if (typeof kopecks !== 'number' || !Number.isInteger(kopecks) || kopecks < 0) {
      return 'Некорректная сумма расхода';
    }
  }

  for (const row of backup.data.gardenPhotos) {
    const id = reqString(row, 'id');
    if (!ids.gardens.has(reqString(row, 'garden_id'))) {
      return 'Фото ссылается на отсутствующий участок';
    }
    if (row.season_id != null && !ids.seasons.has(String(row.season_id))) {
      return 'Фото ссылается на отсутствующий сезон';
    }
    assertOptionalFk(row.area_id, ids.areas);
    assertOptionalFk(row.planting_id, ids.plantings);
    assertOptionalFk(row.event_id, ids.events);
    reqString(row, 'uri');
    const file = backup.data.photoFiles[id];
    if (file) {
      if (typeof file.base64 !== 'string' || typeof file.extension !== 'string') {
        return 'Повреждённый файл фото в резервной копии';
      }
    }
  }

  for (const row of backup.data.appSettings) {
    reqString(row, 'key');
    if (typeof row.value !== 'string') {
      return 'Некорректные настройки приложения';
    }
  }

  const settings = readSettingsFromRows(backup.data.appSettings);
  if (settings.activeSeasonId && !ids.seasons.has(settings.activeSeasonId)) {
    return 'activeSeasonId ссылается на отсутствующий сезон';
  }
  if (settings.activeGardenId && !ids.gardens.has(settings.activeGardenId)) {
    return 'activeGardenId ссылается на отсутствующий участок';
  }

  return null;
}

function buildPreview(backup: GardenDiaryBackupV1): BackupPreview {
  return {
    createdAt: backup.createdAt,
    gardenCount: backup.data.gardens.length,
    seasonCount: backup.data.seasons.length,
    areaCount: backup.data.gardenAreas.length,
    plantingCount: backup.data.plantings.length,
    taskCount: backup.data.gardenTasks.length,
    harvestCount: backup.data.harvests.length,
    expenseCount: backup.data.expenses.length,
    eventCount: backup.data.gardenEvents.length,
    photoCount: backup.data.gardenPhotos.length,
  };
}

function collectIds(rows: Record<string, unknown>[]): Set<string> {
  const set = new Set<string>();
  for (const row of rows) {
    const id = row.id;
    if (typeof id !== 'string' || !id) {
      throw new Error('Missing id');
    }
    if (set.has(id)) {
      throw new Error('Duplicate id');
    }
    set.add(id);
  }
  return set;
}

function reqString(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value !== 'string' || !value) {
    throw new Error(`Missing ${key}`);
  }
  return value;
}

function assertOptionalFk(value: unknown, set: Set<string>): void {
  if (value == null || value === '') {
    return;
  }
  if (!set.has(String(value))) {
    throw new Error('Broken foreign key');
  }
}

function assertEnum(
  value: unknown,
  allowed: readonly string[],
  label: string
): void {
  if (typeof value !== 'string' || !allowed.includes(value)) {
    throw new Error(`Invalid ${label}`);
  }
}

function assertLocalDate(value: unknown, label: string): void {
  if (typeof value !== 'string' || !isValidLocalDateString(value)) {
    throw new Error(`Invalid ${label}`);
  }
}

function assertOptionalLocalDate(value: unknown): void {
  if (value == null || value === '') {
    return;
  }
  assertLocalDate(value, 'date');
}

function assertPositiveNumber(value: unknown, label: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid ${label}`);
  }
}

function assertOptionalPositive(value: unknown): void {
  if (value == null) {
    return;
  }
  assertPositiveNumber(value, 'quantity');
}

function readSettingsFromRows(
  rows: Record<string, unknown>[]
): { activeGardenId: string | null; activeSeasonId: string | null } {
  const map = new Map(rows.map((row) => [String(row.key), String(row.value ?? '')]));
  return {
    activeGardenId: map.get('activeGardenId') || null,
    activeSeasonId: map.get('activeSeasonId') || null,
  };
}

function fail(
  code: 'read_failed' | 'invalid_json' | 'wrong_format' | 'unsupported_version' | 'corrupted' | 'restore_failed',
  message: string
): ParsedBackup {
  return { ok: false, code, message };
}
