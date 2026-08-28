/**
 * Validates backup JSON before any destructive restore operation.
 */

import {
  EXPENSE_CATEGORIES,
  GARDEN_AREA_TYPES,
  HARVEST_UNITS,
  PLANTING_STATUSES,
  QUANTITY_UNITS,
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

  if (
    typeof obj.createdAt !== 'string' ||
    !obj.createdAt ||
    !Number.isFinite(Date.parse(obj.createdAt))
  ) {
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
  const seasons = rowsById(backup.data.seasons);
  const areas = rowsById(backup.data.gardenAreas);
  const catalog = rowsById(backup.data.plantCatalogItems);
  const gardenPlants = rowsById(backup.data.gardenPlants);
  const plantings = rowsById(backup.data.plantings);
  const tasks = rowsById(backup.data.gardenTasks);
  const events = rowsById(backup.data.gardenEvents);

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
    assertEnum(row.type, GARDEN_AREA_TYPES, 'area type');
    assertOptionalPositive(row.length);
    assertOptionalPositive(row.width);
  }

  for (const row of backup.data.plantCatalogItems) {
    if (!ids.gardens.has(reqString(row, 'garden_id'))) {
      return 'Каталог ссылается на отсутствующий участок';
    }
    reqString(row, 'species_name');
  }

  for (const row of backup.data.gardenPlants) {
    const gardenId = reqString(row, 'garden_id');
    if (!ids.gardens.has(gardenId)) {
      return 'Многолетник ссылается на отсутствующий участок';
    }
    if (!ids.catalog.has(reqString(row, 'catalog_item_id'))) {
      return 'Многолетник ссылается на отсутствующую культуру';
    }
    if (row.area_id != null && !ids.areas.has(String(row.area_id))) {
      return 'Многолетник ссылается на отсутствующую зону';
    }
    if (String(catalog.get(String(row.catalog_item_id))?.garden_id) !== gardenId) {
      return 'Многолетник и культура относятся к разным участкам';
    }
    if (row.area_id != null && String(areas.get(String(row.area_id))?.garden_id) !== gardenId) {
      return 'Многолетник и зона относятся к разным участкам';
    }
    assertEnum(row.status, PLANTING_STATUSES, 'status');
    assertOptionalEnum(row.quantity_unit, QUANTITY_UNITS, 'quantity unit');
    assertOptionalPositive(row.quantity);
    assertOptionalLocalDate(row.planted_date);
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
    const gardenId = String(seasons.get(seasonId)?.garden_id);
    if (String(catalog.get(String(row.catalog_item_id))?.garden_id) !== gardenId) {
      return 'Посадка и культура относятся к разным участкам';
    }
    if (row.area_id != null && !ids.areas.has(String(row.area_id))) {
      return 'Посадка ссылается на отсутствующую зону';
    }
    if (row.area_id != null && String(areas.get(String(row.area_id))?.garden_id) !== gardenId) {
      return 'Посадка и зона относятся к разным участкам';
    }
    if (row.garden_plant_id != null) {
      const gp = String(row.garden_plant_id);
      if (!ids.gardenPlants.has(gp)) {
        return 'Посадка ссылается на отсутствующий многолетник';
      }
      if (String(gardenPlants.get(gp)?.garden_id) !== gardenId) {
        return 'Посадка и многолетник относятся к разным участкам';
      }
      const key = `${seasonId}:${gp}`;
      if (plantingPerennialKey.has(key)) {
        return 'Дублирующаяся посадка многолетника в одном сезоне';
      }
      plantingPerennialKey.add(key);
    }
    assertEnum(row.status, PLANTING_STATUSES, 'status');
    assertOptionalEnum(row.quantity_unit, QUANTITY_UNITS, 'quantity unit');
    assertOptionalLocalDate(row.sowing_date);
    assertOptionalLocalDate(row.transplant_date);
    assertOptionalLocalDate(row.harvest_start_date);
    assertOptionalPositive(row.quantity);
  }

  for (const row of backup.data.gardenTasks) {
    const seasonId = reqString(row, 'season_id');
    if (!ids.seasons.has(seasonId)) {
      return 'Задача ссылается на отсутствующий сезон';
    }
    assertOptionalFk(row.area_id, ids.areas);
    assertOptionalFk(row.planting_id, ids.plantings);
    assertOptionalFk(row.completion_event_id, ids.events);
    assertOptionalFk(row.spawned_task_id, ids.tasks);
    const gardenId = String(seasons.get(seasonId)?.garden_id);
    if (!optionalRefBelongsToGarden(row.area_id, areas, gardenId)) return 'Задача и зона относятся к разным участкам';
    if (!optionalSeasonRefMatches(row.planting_id, plantings, seasonId)) return 'Задача и посадка относятся к разным сезонам';
    if (!optionalSeasonRefMatches(row.spawned_task_id, tasks, seasonId)) return 'Связанные задачи относятся к разным сезонам';
    if (!optionalSeasonRefMatches(row.completion_event_id, events, seasonId)) return 'Задача и запись относятся к разным сезонам';
    assertEnum(row.type, WORK_TYPES, 'type');
    assertEnum(row.repeat_type, REPEAT_TYPES, 'repeat_type');
    reqString(row, 'title');
    assertLocalDate(row.due_date, 'due_date');
  }

  for (const row of backup.data.gardenEvents) {
    const seasonId = reqString(row, 'season_id');
    if (!ids.seasons.has(seasonId)) {
      return 'Запись ссылается на отсутствующий сезон';
    }
    assertOptionalFk(row.area_id, ids.areas);
    assertOptionalFk(row.planting_id, ids.plantings);
    assertOptionalFk(row.task_id, ids.tasks);
    const gardenId = String(seasons.get(seasonId)?.garden_id);
    if (!optionalRefBelongsToGarden(row.area_id, areas, gardenId)) return 'Запись и зона относятся к разным участкам';
    if (!optionalSeasonRefMatches(row.planting_id, plantings, seasonId)) return 'Запись и посадка относятся к разным сезонам';
    if (!optionalSeasonRefMatches(row.task_id, tasks, seasonId)) return 'Запись и задача относятся к разным сезонам';
    assertEnum(row.type, WORK_TYPES, 'type');
    reqString(row, 'title');
    assertLocalDate(row.event_date, 'event_date');
  }

  for (const row of backup.data.harvests) {
    const seasonId = reqString(row, 'season_id');
    if (!ids.seasons.has(seasonId)) {
      return 'Урожай ссылается на отсутствующий сезон';
    }
    if (!ids.plantings.has(reqString(row, 'planting_id'))) {
      return 'Урожай ссылается на отсутствующую посадку';
    }
    assertOptionalFk(row.event_id, ids.events);
    if (!optionalSeasonRefMatches(row.planting_id, plantings, seasonId)) return 'Урожай и посадка относятся к разным сезонам';
    if (!optionalSeasonRefMatches(row.event_id, events, seasonId)) return 'Урожай и запись относятся к разным сезонам';
    assertLocalDate(row.date, 'date');
    assertPositiveNumber(row.quantity, 'quantity');
    assertEnum(row.unit, HARVEST_UNITS, 'unit');
  }

  for (const row of backup.data.expenses) {
    const seasonId = reqString(row, 'season_id');
    if (!ids.seasons.has(seasonId)) {
      return 'Расход ссылается на отсутствующий сезон';
    }
    assertOptionalFk(row.area_id, ids.areas);
    assertOptionalFk(row.planting_id, ids.plantings);
    const gardenId = String(seasons.get(seasonId)?.garden_id);
    if (!optionalRefBelongsToGarden(row.area_id, areas, gardenId)) return 'Расход и зона относятся к разным участкам';
    if (!optionalSeasonRefMatches(row.planting_id, plantings, seasonId)) return 'Расход и посадка относятся к разным сезонам';
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
    const gardenId = reqString(row, 'garden_id');
    const seasonId = row.season_id == null ? null : String(row.season_id);
    if (seasonId && String(seasons.get(seasonId)?.garden_id) !== gardenId) return 'Фото и сезон относятся к разным участкам';
    if (!optionalRefBelongsToGarden(row.area_id, areas, gardenId)) return 'Фото и зона относятся к разным участкам';
    if (!optionalSeasonRefBelongsToGarden(row.planting_id, plantings, seasons, gardenId)) return 'Фото и посадка относятся к разным участкам';
    if (!optionalSeasonRefBelongsToGarden(row.event_id, events, seasons, gardenId)) return 'Фото и запись относятся к разным участкам';
    if (seasonId && !optionalSeasonRefMatches(row.planting_id, plantings, seasonId)) return 'Фото и посадка относятся к разным сезонам';
    if (seasonId && !optionalSeasonRefMatches(row.event_id, events, seasonId)) return 'Фото и запись относятся к разным сезонам';
    reqString(row, 'uri');
    const file = backup.data.photoFiles[id];
    if (file) {
      if (typeof file.base64 !== 'string' || typeof file.extension !== 'string') {
        return 'Повреждённый файл фото в резервной копии';
      }
    }
  }

  for (const [photoId, file] of Object.entries(backup.data.photoFiles)) {
    if (!ids.photos.has(photoId) || !isValidPhotoFile(file)) {
      return 'Повреждённый файл фото в резервной копии';
    }
  }

  for (const row of backup.data.appSettings) {
    reqString(row, 'key');
    if (typeof row.value !== 'string') {
      return 'Некорректные настройки приложения';
    }
  }
  if (new Set(backup.data.appSettings.map((row) => String(row.key))).size !== backup.data.appSettings.length) {
    return 'Дублирующиеся настройки приложения';
  }

  const settings = readSettingsFromRows(backup.data.appSettings);
  if (settings.activeSeasonId && !ids.seasons.has(settings.activeSeasonId)) {
    return 'activeSeasonId ссылается на отсутствующий сезон';
  }
  if (settings.activeGardenId && !ids.gardens.has(settings.activeGardenId)) {
    return 'activeGardenId ссылается на отсутствующий участок';
  }
  if (
    settings.activeGardenId &&
    settings.activeSeasonId &&
    String(seasons.get(settings.activeSeasonId)?.garden_id) !== settings.activeGardenId
  ) {
    return 'Активный сезон относится к другому участку';
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

function rowsById(
  rows: Record<string, unknown>[]
): Map<string, Record<string, unknown>> {
  return new Map(rows.map((row) => [String(row.id), row]));
}

function optionalRefBelongsToGarden(
  value: unknown,
  rows: Map<string, Record<string, unknown>>,
  gardenId: string
): boolean {
  if (value == null || value === '') return true;
  return String(rows.get(String(value))?.garden_id) === gardenId;
}

function optionalSeasonRefMatches(
  value: unknown,
  rows: Map<string, Record<string, unknown>>,
  seasonId: string
): boolean {
  if (value == null || value === '') return true;
  return String(rows.get(String(value))?.season_id) === seasonId;
}

function optionalSeasonRefBelongsToGarden(
  value: unknown,
  rows: Map<string, Record<string, unknown>>,
  seasons: Map<string, Record<string, unknown>>,
  gardenId: string
): boolean {
  if (value == null || value === '') return true;
  const seasonId = String(rows.get(String(value))?.season_id);
  return String(seasons.get(seasonId)?.garden_id) === gardenId;
}

function isValidPhotoFile(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const file = value as Record<string, unknown>;
  if (
    typeof file.extension !== 'string' ||
    !/^\.(?:jpe?g|png|webp|heic)$/i.test(file.extension) ||
    typeof file.base64 !== 'string' ||
    file.base64.length === 0 ||
    file.base64.length % 4 !== 0
  ) {
    return false;
  }
  return /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
    file.base64
  );
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

function assertOptionalEnum(
  value: unknown,
  allowed: readonly string[],
  label: string
): void {
  if (value == null || value === '') return;
  assertEnum(value, allowed, label);
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
