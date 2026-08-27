/**
 * Database foundation tests — migrations, FK, CRUD, delete semantics.
 */

import initSqlJs from 'sql.js';

import {
  areForeignKeysEnabled,
  createDatabaseFromClient,
} from '@/src/db/database';
import { CURRENT_SCHEMA_VERSION } from '@/src/db/migrations';
import { createSqlJsAdapter } from '@/src/db/sqlJsAdapter';
import type { SqlDatabase } from '@/src/db/types';
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
  test('fresh database initializes to schema version 1', async () => {
    const db = await openTestDb();
    expect(db.getUserVersion()).toBe(CURRENT_SCHEMA_VERSION);
    expect(CURRENT_SCHEMA_VERSION).toBe(1);

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

    gardens.delete(garden.id);
    expect(seasons.getById(season.id)).toBeNull();
    expect(areas.getById(area.id)).toBeNull();
  });
});
