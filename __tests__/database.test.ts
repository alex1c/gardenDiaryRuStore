/**
 * Database foundation tests — migrations, FK, CRUD, delete semantics.
 */

import initSqlJs from 'sql.js';

import {
  areForeignKeysEnabled,
  createDatabaseFromClient,
} from '@/src/db/database';
import { CURRENT_SCHEMA_VERSION } from '@/src/db/migrations';
import { runMigrations } from '@/src/db/migrate';
import { createSqlJsAdapter } from '@/src/db/sqlJsAdapter';
import type { Migration, SqlDatabase } from '@/src/db/types';
import { GardenAreaRepository } from '@/src/repositories/GardenAreaRepository';
import { GardenRepository } from '@/src/repositories/GardenRepository';
import { PlantCatalogRepository } from '@/src/repositories/PlantCatalogRepository';
import { PlantingRepository } from '@/src/repositories/PlantingRepository';
import { SeasonRepository } from '@/src/repositories/SeasonRepository';
import { bootstrapGardenWithSeason } from '@/src/services/bootstrapGarden';

async function openTestDb(): Promise<SqlDatabase> {
  const SQL = await initSqlJs();
  const raw = new SQL.Database();
  const adapter = createSqlJsAdapter(raw);
  return createDatabaseFromClient(adapter);
}

describe('database foundation', () => {
  test('fresh database initializes to schema version 3', async () => {
    const db = await openTestDb();
    expect(db.getUserVersion()).toBe(CURRENT_SCHEMA_VERSION);
    expect(CURRENT_SCHEMA_VERSION).toBe(3);

    const tables = db.getAll<{ name: string }>(
      `SELECT name FROM sqlite_master
       WHERE type = 'table' AND name = 'gardens'`
    );
    expect(tables).toHaveLength(1);
  });

  test('re-initialization is idempotent and preserves data', async () => {
    const SQL = await initSqlJs();
    const raw = new SQL.Database();
    const adapter = createSqlJsAdapter(raw);

    const db1 = createDatabaseFromClient(adapter);
    const gardens = new GardenRepository(db1);
    const garden = gardens.create({ name: 'Тестовая дача' });

    const db2 = createDatabaseFromClient(adapter);
    expect(db2.getUserVersion()).toBe(CURRENT_SCHEMA_VERSION);
    expect(new GardenRepository(db2).getById(garden.id)?.name).toBe('Тестовая дача');
  });

  test('foreign keys are enabled', async () => {
    const db = await openTestDb();
    expect(areForeignKeysEnabled(db)).toBe(true);
  });

  test('applies a future migration atomically and only once', async () => {
    const db = await openTestDb();
    const migrations: Migration[] = [
      { version: 1, name: 'existing', up: () => undefined },
      { version: 2, name: 'existing_v2', up: () => undefined },
      { version: 3, name: 'existing_v3', up: () => undefined },
      {
        version: 4,
        name: 'fake_v4',
        up: (database) => database.exec('CREATE TABLE migration_v4_probe (id INTEGER)'),
      },
    ];

    runMigrations(db, migrations);
    runMigrations(db, migrations);

    expect(db.getUserVersion()).toBe(4);
    expect(db.getAll("SELECT name FROM sqlite_master WHERE name = 'migration_v4_probe'"))
      .toHaveLength(1);
  });

  test('rolls back a failed migration without advancing user_version', async () => {
    const db = await openTestDb();
    const migrations: Migration[] = [
      { version: 1, name: 'existing', up: () => undefined },
      { version: 2, name: 'existing_v2', up: () => undefined },
      { version: 3, name: 'existing_v3', up: () => undefined },
      {
        version: 4,
        name: 'broken_v4',
        up: (database) => {
          database.exec('CREATE TABLE must_rollback (id INTEGER)');
          database.exec('THIS IS NOT SQL');
        },
      },
    ];

    expect(() => runMigrations(db, migrations)).toThrow(/Migration 4/);
    expect(db.getUserVersion()).toBe(CURRENT_SCHEMA_VERSION);
    expect(db.getAll("SELECT name FROM sqlite_master WHERE name = 'must_rollback'"))
      .toHaveLength(0);
  });

  test('rejects migration gaps and databases newer than this app', async () => {
    const db = await openTestDb();
    expect(() =>
      runMigrations(db, [
        { version: 1, name: 'existing', up: () => undefined },
        { version: 3, name: 'gap', up: () => undefined },
      ])
    ).toThrow(/expected version 2/);

    db.setUserVersion(4);
    expect(() => runMigrations(db)).toThrow(/newer than supported/);
  });
});

describe('Garden / Season / Area CRUD', () => {
  test('garden create/read/update/delete', async () => {
    const db = await openTestDb();
    const gardens = new GardenRepository(db);

    const created = gardens.create({ name: '  Участок А  ', locationName: 'Саратов' });
    expect(created.name).toBe('Участок А');
    expect(gardens.getById(created.id)?.locationName).toBe('Саратов');

    const updated = gardens.update(created.id, { name: 'Участок Б' });
    expect(updated.name).toBe('Участок Б');
    expect(gardens.listAll()).toHaveLength(1);

    expect(gardens.delete(created.id)).toBe(true);
    expect(gardens.getById(created.id)).toBeNull();
  });

  test('season is bound to garden; bootstrap creates default season', async () => {
    const db = await openTestDb();
    const { garden, season } = bootstrapGardenWithSeason(db, {
      gardenName: 'Моя дача',
      year: 2026,
    });

    expect(season.gardenId).toBe(garden.id);
    expect(season.year).toBe(2026);
    expect(season.title).toBe('Сезон 2026');
    expect(season.archived).toBe(false);

    const seasons = new SeasonRepository(db);
    expect(seasons.getActiveForGarden(garden.id)?.id).toBe(season.id);
  });

  test('area create and listing', async () => {
    const db = await openTestDb();
    const { garden } = bootstrapGardenWithSeason(db, { gardenName: 'Дача' });
    const areas = new GardenAreaRepository(db);

    areas.create({ gardenId: garden.id, name: 'Грядка 1', type: 'garden_bed' });
    areas.create({ gardenId: garden.id, name: 'Теплица', type: 'greenhouse' });

    const listed = areas.listByGarden(garden.id);
    expect(listed).toHaveLength(2);
    expect(listed.map((a) => a.type).sort()).toEqual(['garden_bed', 'greenhouse']);
  });
});

describe('PlantCatalog + Planting', () => {
  test('catalog item and planting create correctly', async () => {
    const db = await openTestDb();
    const { garden, season } = bootstrapGardenWithSeason(db, { gardenName: 'Дача' });
    const catalog = new PlantCatalogRepository(db);
    const plantings = new PlantingRepository(db);
    const areas = new GardenAreaRepository(db);

    const area = areas.create({
      gardenId: garden.id,
      name: 'Теплица',
      type: 'greenhouse',
    });
    const item = catalog.create({
      gardenId: garden.id,
      speciesName: 'Томат',
      varietyName: 'Бычье сердце',
    });
    const planting = plantings.create({
      seasonId: season.id,
      catalogItemId: item.id,
      areaId: area.id,
      status: 'planned',
      quantity: 6,
      quantityUnit: 'pcs',
    });

    expect(planting.catalogItemId).toBe(item.id);
    expect(planting.areaId).toBe(area.id);
    expect(plantings.listBySeason(season.id)).toHaveLength(1);
  });

  test('active season selection is deterministic when several are open', async () => {
    const db = await openTestDb();
    const { garden } = bootstrapGardenWithSeason(db, { gardenName: 'Seasons', year: 2026 });
    const seasons = new SeasonRepository(db);
    seasons.create({ gardenId: garden.id, year: 2027, title: 'First 2027' });
    seasons.create({ gardenId: garden.id, year: 2027, title: 'Second 2027' });

    const firstRead = seasons.getActiveForGarden(garden.id);
    expect(firstRead?.year).toBe(2027);
    expect(seasons.getActiveForGarden(garden.id)?.id).toBe(firstRead?.id);
  });

  test('rejects cross-garden planting links on create and update', async () => {
    const db = await openTestDb();
    const first = bootstrapGardenWithSeason(db, { gardenName: 'First', year: 2026 });
    const second = bootstrapGardenWithSeason(db, { gardenName: 'Second', year: 2026 });
    const catalog = new PlantCatalogRepository(db);
    const areas = new GardenAreaRepository(db);
    const plantings = new PlantingRepository(db);
    const firstItem = catalog.create({ gardenId: first.garden.id, speciesName: 'Apple' });
    const secondItem = catalog.create({ gardenId: second.garden.id, speciesName: 'Pear' });
    const secondArea = areas.create({
      gardenId: second.garden.id,
      name: 'Foreign area',
      type: 'other',
    });

    expect(() =>
      plantings.create({
        seasonId: first.season.id,
        catalogItemId: secondItem.id,
      })
    ).toThrow(/different gardens/);
    expect(() =>
      plantings.create({
        seasonId: first.season.id,
        catalogItemId: firstItem.id,
        areaId: secondArea.id,
      })
    ).toThrow(/different gardens/);

    const valid = plantings.create({
      seasonId: first.season.id,
      catalogItemId: firstItem.id,
    });
    expect(() => plantings.update(valid.id, { catalogItemId: secondItem.id }))
      .toThrow(/different gardens/);
  });

  test('rejects non-finite, zero, and negative physical values', async () => {
    const db = await openTestDb();
    const { garden, season } = bootstrapGardenWithSeason(db, { gardenName: 'Values' });
    const catalog = new PlantCatalogRepository(db);
    const areas = new GardenAreaRepository(db);
    const plantings = new PlantingRepository(db);
    const item = catalog.create({ gardenId: garden.id, speciesName: 'Carrot' });

    expect(() => areas.create({ gardenId: garden.id, name: 'Bad', type: 'other', width: 0 }))
      .toThrow(/positive finite/);
    expect(() => plantings.create({ seasonId: season.id, catalogItemId: item.id, quantity: -1 }))
      .toThrow(/positive finite/);
    expect(() => plantings.create({ seasonId: season.id, catalogItemId: item.id, quantity: Infinity }))
      .toThrow(/positive finite/);
  });
});

describe('repository transactions and patch semantics', () => {
  test('bootstrap rolls back garden when season creation fails', async () => {
    const db = await openTestDb();
    expect(() => bootstrapGardenWithSeason(db, { gardenName: 'Rollback', year: 2026.5 }))
      .toThrow();
    expect(new GardenRepository(db).listAll()).toHaveLength(0);
  });

  test('omitted fields stay unchanged and explicit null clears nullable fields', async () => {
    const db = await openTestDb();
    const gardens = new GardenRepository(db);
    const garden = gardens.create({ name: 'Patch', locationName: 'Moscow', notes: 'note' });
    expect(gardens.update(garden.id, { name: 'Patch 2' }).locationName).toBe('Moscow');
    expect(gardens.update(garden.id, { locationName: null }).locationName).toBeNull();
  });
});

describe('FK constraints and delete policy', () => {
  test('rejects planting with non-existent season FK', async () => {
    const db = await openTestDb();
    const { garden } = bootstrapGardenWithSeason(db, { gardenName: 'Дача' });
    const catalog = new PlantCatalogRepository(db);
    const plantings = new PlantingRepository(db);

    const item = catalog.create({
      gardenId: garden.id,
      speciesName: 'Огурец',
    });

    expect(() =>
      plantings.create({
        seasonId: '00000000-0000-4000-8000-000000000099',
        catalogItemId: item.id,
      })
    ).toThrow();
  });

  test('deleting area sets planting.area_id to NULL (history preserved)', async () => {
    const db = await openTestDb();
    const { garden, season } = bootstrapGardenWithSeason(db, { gardenName: 'Дача' });
    const areas = new GardenAreaRepository(db);
    const catalog = new PlantCatalogRepository(db);
    const plantings = new PlantingRepository(db);

    const area = areas.create({
      gardenId: garden.id,
      name: 'Грядка',
      type: 'garden_bed',
    });
    const item = catalog.create({ gardenId: garden.id, speciesName: 'Укроп' });
    const planting = plantings.create({
      seasonId: season.id,
      catalogItemId: item.id,
      areaId: area.id,
    });

    areas.delete(area.id);
    expect(plantings.getById(planting.id)?.areaId).toBeNull();
  });

  test('deleting season cascades plantings', async () => {
    const db = await openTestDb();
    const { garden, season } = bootstrapGardenWithSeason(db, { gardenName: 'Дача' });
    const catalog = new PlantCatalogRepository(db);
    const plantings = new PlantingRepository(db);
    const seasons = new SeasonRepository(db);

    const item = catalog.create({ gardenId: garden.id, speciesName: 'Морковь' });
    const planting = plantings.create({
      seasonId: season.id,
      catalogItemId: item.id,
    });

    seasons.delete(season.id);
    expect(plantings.getById(planting.id)).toBeNull();
  });

  test('deleting catalog item with planting is restricted', async () => {
    const db = await openTestDb();
    const { garden, season } = bootstrapGardenWithSeason(db, { gardenName: 'Дача' });
    const catalog = new PlantCatalogRepository(db);
    const plantings = new PlantingRepository(db);

    const item = catalog.create({ gardenId: garden.id, speciesName: 'Перец' });
    plantings.create({
      seasonId: season.id,
      catalogItemId: item.id,
    });

    expect(() => catalog.delete(item.id)).toThrow();
  });

  test('deleting garden cascades seasons and areas', async () => {
    const db = await openTestDb();
    const { garden, season } = bootstrapGardenWithSeason(db, { gardenName: 'Дача' });
    const gardens = new GardenRepository(db);
    const seasons = new SeasonRepository(db);
    const areas = new GardenAreaRepository(db);

    const area = areas.create({
      gardenId: garden.id,
      name: 'Зона',
      type: 'other',
    });

    const catalog = new PlantCatalogRepository(db);
    const item = catalog.create({ gardenId: garden.id, speciesName: 'History' });
    const planting = new PlantingRepository(db).create({
      seasonId: season.id,
      catalogItemId: item.id,
      areaId: area.id,
    });
    const now = new Date().toISOString();
    db.run(
      `INSERT INTO garden_tasks
       (id, season_id, area_id, planting_id, type, title, due_date, created_at, updated_at)
       VALUES ('task', ?, ?, ?, 'other', 'Task', '2026-05-10', ?, ?)`,
      [season.id, area.id, planting.id, now, now]
    );
    db.run(
      `INSERT INTO garden_events
       (id, season_id, area_id, planting_id, task_id, type, title, event_date, created_at, updated_at)
       VALUES ('event', ?, ?, ?, 'task', 'other', 'Event', '2026-05-10', ?, ?)`,
      [season.id, area.id, planting.id, now, now]
    );
    db.run(
      `INSERT INTO harvests
       (id, season_id, planting_id, date, quantity, unit, created_at, updated_at)
       VALUES ('harvest', ?, ?, '2026-08-10', 1, 'kg', ?, ?)`,
      [season.id, planting.id, now, now]
    );
    db.run(
      `INSERT INTO expenses
       (id, season_id, area_id, planting_id, date, category, amount_kopecks, created_at, updated_at)
       VALUES ('expense', ?, ?, ?, '2026-05-10', 'other', 100, ?, ?)`,
      [season.id, area.id, planting.id, now, now]
    );
    db.run(
      `INSERT INTO garden_photos
       (id, garden_id, area_id, uri, created_at)
       VALUES ('photo', ?, ?, 'file://photo.jpg', ?)`,
      [garden.id, area.id, now]
    );

    gardens.delete(garden.id);
    expect(seasons.getById(season.id)).toBeNull();
    expect(areas.getById(area.id)).toBeNull();
    for (const table of [
      'plant_catalog_items',
      'plantings',
      'garden_tasks',
      'garden_events',
      'harvests',
      'expenses',
      'garden_photos',
    ]) {
      expect(db.getFirst<{ count: number }>(`SELECT COUNT(*) AS count FROM ${table}`)?.count)
        .toBe(0);
    }
  });
});
