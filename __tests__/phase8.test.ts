/**
 * Phase 8 tests — backup, restore, CSV export.
 */

import initSqlJs from 'sql.js';

import { createDatabaseFromClient } from '@/src/db/database';
import { createSqlJsAdapter } from '@/src/db/sqlJsAdapter';
import type { SqlDatabase, SqlRunResult } from '@/src/db/types';
import { GardenAreaRepository } from '@/src/repositories/GardenAreaRepository';
import { GardenEventRepository } from '@/src/repositories/GardenEventRepository';
import { GardenPhotoRepository } from '@/src/repositories/GardenPhotoRepository';
import { GardenTaskRepository } from '@/src/repositories/GardenTaskRepository';
import { ExpenseRepository } from '@/src/repositories/ExpenseRepository';
import { PlantCatalogRepository } from '@/src/repositories/PlantCatalogRepository';
import { PlantingRepository } from '@/src/repositories/PlantingRepository';
import { SettingsRepository } from '@/src/repositories/SettingsRepository';
import { bootstrapGardenWithSeason } from '@/src/services/bootstrapGarden';
import { createHarvest } from '@/src/services/harvestService';
import { createPlantingWithOptionalPerennial } from '@/src/services/plantingService';
import { createSeasonWithOptions } from '@/src/services/seasonCloneService';
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  type BackupPhotoWriter,
} from '@/src/services/backup/backupTypes';
import { readBackupTableSnapshot } from '@/src/services/backup/backupSnapshot';
import { createBackupJson } from '@/src/services/backup/createBackup';
import { restoreBackupV1 } from '@/src/services/backup/restoreBackup';
import {
  parseAndValidateBackupJson,
  validateBackupObject,
} from '@/src/services/backup/validateBackup';
import {
  buildCsvRow,
  escapeCsvField,
  withUtf8Bom,
} from '@/src/services/export/csv';
import { exportGardenCsv } from '@/src/services/export/exportData';

async function openTestDb(): Promise<SqlDatabase> {
  const SQL = await initSqlJs();
  const raw = new SQL.Database();
  return createDatabaseFromClient(createSqlJsAdapter(raw));
}

function createMemoryPhotoIo() {
  const files = new Map<string, { extension: string; base64: string }>();
  const uris = new Map<string, string>();

  return {
    files,
    reader: {
      async readOwnedPhotoBase64(uri: string) {
        for (const [id, file] of files.entries()) {
          if (uris.get(id) === uri) {
            return file;
          }
        }
        return null;
      },
    },
    writer: {
      async writePhotoFile(photoId: string, file: { extension: string; base64: string }) {
        files.set(photoId, file);
        const uri = `memory://photos/${photoId}${file.extension}`;
        uris.set(photoId, uri);
        return uri;
      },
      async deletePhotoFile(uri: string) {
        for (const [id, storedUri] of uris.entries()) {
          if (storedUri === uri) {
            uris.delete(id);
            files.delete(id);
          }
        }
      },
    } satisfies BackupPhotoWriter,
  };
}

async function seedRichFixture(db: SqlDatabase) {
  const { garden, season } = bootstrapGardenWithSeason(db, {
    gardenName: 'Дача «Ромашка»',
    year: 2026,
  });
  const areas = new GardenAreaRepository(db);
  const area = areas.create({
    gardenId: garden.id,
    name: 'Теплица',
    type: 'greenhouse',
  });
  const catalog = new PlantCatalogRepository(db);
  const tomato = catalog.create({
    gardenId: garden.id,
    speciesName: 'Томат',
    varietyName: 'Бычье сердце',
  });
  const apple = catalog.create({
    gardenId: garden.id,
    speciesName: 'Яблоня',
    varietyName: 'Антоновка',
  });

  createPlantingWithOptionalPerennial(db, {
    seasonId: season.id,
    catalogItemId: apple.id,
    areaId: area.id,
    isPerennial: true,
    status: 'growing',
    notes: 'У забора',
  });

  const annual = new PlantingRepository(db).create({
    seasonId: season.id,
    catalogItemId: tomato.id,
    areaId: area.id,
    status: 'growing',
    notes: 'Ряд 1; тест',
  });

  new GardenTaskRepository(db).create({
    seasonId: season.id,
    title: 'Полить',
    type: 'watering',
    dueDate: '2026-06-01',
    plantingId: annual.id,
  });

  new GardenEventRepository(db).create({
    seasonId: season.id,
    title: 'Подкормка',
    type: 'feeding',
    eventDate: '2026-06-02',
    plantingId: annual.id,
    notes: 'NPK',
  });

  createHarvest(db, {
    seasonId: season.id,
    plantingId: annual.id,
    date: '2026-08-10',
    quantity: 3.5,
    unit: 'kg',
  });

  new ExpenseRepository(db).create({
    seasonId: season.id,
    date: '2026-05-01',
    category: 'seedlings',
    amountKopecks: 125000,
    areaId: area.id,
  });

  new GardenPhotoRepository(db).create({
    gardenId: garden.id,
    seasonId: season.id,
    uri: 'file://placeholder/photo.jpg',
    caption: 'Фото',
  });

  createSeasonWithOptions(db, {
    gardenId: garden.id,
    year: 2027,
    title: 'Сезон 2027',
    sourceSeasonId: season.id,
    copyPerennials: true,
  });

  new SettingsRepository(db).patch({
    activeGardenId: garden.id,
    activeSeasonId: season.id,
  });
}

describe('Backup format', () => {
  test('includes format metadata and all tables', async () => {
    const db = await openTestDb();
    await seedRichFixture(db);

    const backup = await createBackupJson(db, createMemoryPhotoIo().reader);
    expect(backup.format).toBe(BACKUP_FORMAT);
    expect(backup.version).toBe(BACKUP_VERSION);
    expect(backup.data.gardens.length).toBeGreaterThan(0);
    expect(backup.data.seasons.length).toBeGreaterThanOrEqual(2);
    expect(backup.data.plantings.length).toBeGreaterThanOrEqual(2);
    expect(backup.data.appSettings.length).toBeGreaterThan(0);
  });

  test('preserves unicode notes in JSON roundtrip', async () => {
    const db = await openTestDb();
    await seedRichFixture(db);
    const backup = await createBackupJson(db, createMemoryPhotoIo().reader);
    const parsed = parseAndValidateBackupJson(JSON.stringify(backup));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      const notes = parsed.backup.data.plantings.map((row) => row.notes);
      expect(notes.some((value) => String(value).includes('Ряд 1'))).toBe(true);
    }
  });
});

describe('Backup validation', () => {
  test('rejects invalid JSON', async () => {
    const result = parseAndValidateBackupJson('{');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('invalid_json');
    }
  });

  test('rejects wrong format marker', async () => {
    const result = validateBackupObject({
      format: 'other',
      version: 1,
      createdAt: '2026-08-28T10:00:00.000Z',
      app: { package: null, appVersion: null },
      data: {},
    });
    expect(result.ok).toBe(false);
  });

  test('rejects unsupported future version', async () => {
    const result = validateBackupObject({
      format: BACKUP_FORMAT,
      version: 99,
      createdAt: '2026-08-28T10:00:00.000Z',
      app: { package: null, appVersion: null },
      data: {
        gardens: [],
        seasons: [],
        gardenAreas: [],
        plantCatalogItems: [],
        gardenPlants: [],
        plantings: [],
        gardenTasks: [],
        gardenEvents: [],
        harvests: [],
        expenses: [],
        gardenPhotos: [],
        appSettings: [],
        photoFiles: {},
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('unsupported_version');
    }
  });

  test('rejects cross-garden relationships before restore', async () => {
    const db = await openTestDb();
    await seedRichFixture(db);
    const other = bootstrapGardenWithSeason(db, { gardenName: 'Other', year: 2025 });
    const otherArea = new GardenAreaRepository(db).create({
      gardenId: other.garden.id,
      name: 'Foreign area',
      type: 'garden_bed',
    });
    const backup = await createBackupJson(db, createMemoryPhotoIo().reader);
    backup.data.plantings[0].area_id = otherArea.id;

    expect(validateBackupObject(backup).ok).toBe(false);
  });

  test('rejects malformed base64, unsafe extensions, and orphan photo payloads', async () => {
    const db = await openTestDb();
    await seedRichFixture(db);
    const backup = await createBackupJson(db, createMemoryPhotoIo().reader);
    const photoId = String(backup.data.gardenPhotos[0].id);

    backup.data.photoFiles[photoId] = { extension: '../../db', base64: '***' };
    expect(validateBackupObject(backup).ok).toBe(false);

    backup.data.photoFiles = {
      missingPhoto: { extension: '.jpg', base64: 'YWJj' },
    };
    expect(validateBackupObject(backup).ok).toBe(false);
  });
});

describe('Backup restore', () => {
  test('full roundtrip preserves logical data', async () => {
    const db = await openTestDb();
    await seedRichFixture(db);
    const before = readBackupTableSnapshot(db);
    const io = createMemoryPhotoIo();

    const backup = await createBackupJson(db, io.reader);
    const photoRow = backup.data.gardenPhotos[0];
    if (photoRow) {
      const photoId = String(photoRow.id);
      backup.data.photoFiles[photoId] = { extension: '.jpg', base64: 'abc' };
    }

    db.run('DELETE FROM gardens');
    expect(db.getAll('SELECT * FROM gardens')).toHaveLength(0);

    await restoreBackupV1(db, backup, io.writer);
    const after = readBackupTableSnapshot(db);

    expect(after.gardens).toEqual(before.gardens);
    expect(after.seasons).toEqual(before.seasons);
    expect(after.plantings.length).toBe(before.plantings.length);
    expect(after.gardenTasks.length).toBe(before.gardenTasks.length);
    expect(after.harvests.length).toBe(before.harvests.length);
    expect(after.expenses.length).toBe(before.expenses.length);

    const settings = new SettingsRepository(db).getSettings();
    expect(settings.activeGardenId).toBeTruthy();
    expect(settings.activeSeasonId).toBeTruthy();
  });

  test('late restore failure rolls back original data', async () => {
    const db = await openTestDb();
    await seedRichFixture(db);
    const backup = await createBackupJson(db, createMemoryPhotoIo().reader);
    const photoId = String(backup.data.gardenPhotos[0].id);
    backup.data.photoFiles[photoId] = { extension: '.jpg', base64: 'YWJj' };

    bootstrapGardenWithSeason(db, { gardenName: 'Other', year: 2025 });
    const originalAtRestore = readBackupTableSnapshot(db);
    const io = createMemoryPhotoIo();

    const failingDb = failOnSql(db, /INSERT INTO app_settings/i);
    await expect(
      restoreBackupV1(failingDb as unknown as SqlDatabase, backup, io.writer)
    ).rejects.toThrow();

    const afterFailed = readBackupTableSnapshot(db);
    expect(afterFailed).toEqual(originalAtRestore);
    expect(io.files.size).toBe(0);
    expect(db.getUserVersion()).toBe(4);
  });

  test('cleans already staged files if a later photo write fails', async () => {
    const db = await openTestDb();
    await seedRichFixture(db);
    const original = readBackupTableSnapshot(db);
    const backup = await createBackupJson(db, createMemoryPhotoIo().reader);
    const first = backup.data.gardenPhotos[0]!;
    const secondId = 'second-photo';
    backup.data.gardenPhotos.push({ ...first, id: secondId });
    backup.data.photoFiles[String(first.id)] = { extension: '.jpg', base64: 'YWJj' };
    backup.data.photoFiles[secondId] = { extension: '.jpg', base64: 'ZGVm' };
    const staged = new Set<string>();
    let writes = 0;
    const writer: BackupPhotoWriter = {
      async writePhotoFile(photoId) {
        writes += 1;
        if (writes === 2) throw new Error('disk full');
        const uri = `memory://staged/${photoId}`;
        staged.add(uri);
        return uri;
      },
      async deletePhotoFile(uri) {
        staged.delete(uri);
      },
    };

    await expect(restoreBackupV1(db, backup, writer)).rejects.toThrow();
    expect(readBackupTableSnapshot(db)).toEqual(original);
    expect(staged.size).toBe(0);
  });

  test('restore replaces rather than merges datasets', async () => {
    const db = await openTestDb();
    await seedRichFixture(db);
    const backup = await createBackupJson(db, createMemoryPhotoIo().reader);
    const other = bootstrapGardenWithSeason(db, { gardenName: 'A-only', year: 2025 });

    await restoreBackupV1(db, backup, createMemoryPhotoIo().writer);

    expect(db.getFirst('SELECT id FROM gardens WHERE id = ?', [other.garden.id])).toBeNull();
    expect(db.getAll('PRAGMA foreign_key_check')).toHaveLength(0);
  });

  test('obsolete photo cleanup failure does not invalidate a successful restore', async () => {
    const db = await openTestDb();
    await seedRichFixture(db);
    const backup = await createBackupJson(db, createMemoryPhotoIo().reader);
    const writer: BackupPhotoWriter = {
      async writePhotoFile() {
        return 'memory://unused';
      },
      async deletePhotoFile() {
        throw new Error('cleanup unavailable');
      },
    };

    await expect(restoreBackupV1(db, backup, writer)).resolves.toBeUndefined();
    expect(db.getAll('PRAGMA foreign_key_check')).toHaveLength(0);
  });
});

describe('CSV export', () => {
  test('uses BOM and semicolon separator', async () => {
    const db = await openTestDb();
    await seedRichFixture(db);
    const csv = exportGardenCsv(db);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv.split('\n')[0]).toContain(';');
  });

  test('escapes semicolons quotes and newlines', () => {
    expect(escapeCsvField('a;b')).toBe('"a;b"');
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"');
    expect(buildCsvRow(['plain', 'a;b'])).toBe('plain;"a;b"');
    expect(withUtf8Bom('x').charCodeAt(0)).toBe(0xfeff);
  });

  test('neutralizes spreadsheet formulas in text fields only', () => {
    expect(escapeCsvField('=HYPERLINK(A1)')).toBe("'=HYPERLINK(A1)");
    expect(escapeCsvField('+SUM(1;2)')).toBe("\"'+SUM(1;2)\"");
    expect(escapeCsvField('@cmd')).toBe("'@cmd");
    expect(escapeCsvField(42)).toBe('42');
  });

  test('includes Russian text', async () => {
    const db = await openTestDb();
    await seedRichFixture(db);
    const csv = exportGardenCsv(db);
    expect(csv).toContain('Томат');
    expect(csv).toContain('Ряд 1');
  });
});

function failOnSql(db: SqlDatabase, pattern: RegExp): SqlDatabase {
  return {
    exec(sql: string): void {
      db.exec(sql);
    },
    run(sql: string, params?: unknown[]): SqlRunResult {
      if (pattern.test(sql)) {
        throw new Error('Simulated late restore failure');
      }
      return db.run(sql, params);
    },
    getAll<T>(sql: string, params?: unknown[]): T[] {
      return db.getAll<T>(sql, params);
    },
    getFirst<T>(sql: string, params?: unknown[]): T | null {
      return db.getFirst<T>(sql, params);
    },
    withTransaction<T>(fn: () => T): T {
      return db.withTransaction(fn);
    },
    getUserVersion(): number {
      return db.getUserVersion();
    },
    setUserVersion(version: number): void {
      db.setUserVersion(version);
    },
  };
}
