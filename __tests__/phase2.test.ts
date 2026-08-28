/**
 * Phase 2 tests — areas, plantings, catalog reuse, cross-garden safety.
 */

import initSqlJs from 'sql.js';

import { createDatabaseFromClient } from '@/src/db/database';
import { createSqlJsAdapter } from '@/src/db/sqlJsAdapter';
import type { SqlDatabase } from '@/src/db/types';
import { GardenAreaRepository } from '@/src/repositories/GardenAreaRepository';
import { PlantCatalogRepository } from '@/src/repositories/PlantCatalogRepository';
import { PlantingRepository } from '@/src/repositories/PlantingRepository';
import { SeasonRepository } from '@/src/repositories/SeasonRepository';
import { bootstrapGardenWithSeason } from '@/src/services/bootstrapGarden';
import { resolveCatalogItemForPlanting } from '@/src/services/plantCatalogService';
import {
  finalizePositiveNumber,
  parseFlexibleNumber,
} from '@/src/utils/numeric';

async function openTestDb(): Promise<SqlDatabase> {
  const SQL = await initSqlJs();
  const raw = new SQL.Database();
  return createDatabaseFromClient(createSqlJsAdapter(raw));
}

describe('Phase 2 — areas', () => {
  test('create and edit area with optional dimensions', async () => {
    const db = await openTestDb();
    const { garden } = bootstrapGardenWithSeason(db, { gardenName: 'Дача' });
    const areas = new GardenAreaRepository(db);

    const created = areas.create({
      gardenId: garden.id,
      name: 'Грядка 1',
      type: 'garden_bed',
      length: 6,
      width: 1,
    });
    expect(created.length).toBe(6);
    expect(created.width).toBe(1);

    const updated = areas.update(created.id, {
      name: 'Грядка 2',
      length: null,
      width: null,
    });
    expect(updated.name).toBe('Грядка 2');
    expect(updated.length).toBeNull();
    expect(updated.width).toBeNull();
  });

  test('rejects invalid area dimensions', async () => {
    const db = await openTestDb();
    const { garden } = bootstrapGardenWithSeason(db, { gardenName: 'Дача' });
    const areas = new GardenAreaRepository(db);

    expect(() =>
      areas.create({
        gardenId: garden.id,
        name: 'Bad',
        type: 'garden_bed',
        length: 0,
      })
    ).toThrow(/positive/i);

    expect(() =>
      areas.create({
        gardenId: garden.id,
        name: 'Bad',
        type: 'garden_bed',
        width: -2,
      })
    ).toThrow(/positive/i);
  });
});

describe('Phase 2 — plantings', () => {
  test('creates planting in active season for garden', async () => {
    const db = await openTestDb();
    const { garden, season } = bootstrapGardenWithSeason(db, {
      gardenName: 'Дача',
      year: 2026,
    });
    const seasons = new SeasonRepository(db);
    const areas = new GardenAreaRepository(db);
    const catalog = new PlantCatalogRepository(db);
    const plantings = new PlantingRepository(db);

    const active = seasons.getActiveForGarden(garden.id);
    expect(active?.id).toBe(season.id);

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
      quantity: 6,
      quantityUnit: 'bushes',
      status: 'growing',
    });

    expect(planting.seasonId).toBe(season.id);
    expect(plantings.listBySeasonAndArea(season.id, area.id)).toHaveLength(1);
  });

  test('moves planting between areas in the same garden', async () => {
    const db = await openTestDb();
    const { garden, season } = bootstrapGardenWithSeason(db, { gardenName: 'Дача' });
    const areas = new GardenAreaRepository(db);
    const catalog = new PlantCatalogRepository(db);
    const plantings = new PlantingRepository(db);

    const a1 = areas.create({ gardenId: garden.id, name: 'A1', type: 'garden_bed' });
    const a2 = areas.create({ gardenId: garden.id, name: 'A2', type: 'garden_bed' });
    const item = catalog.create({ gardenId: garden.id, speciesName: 'Огурец' });
    const planting = plantings.create({
      seasonId: season.id,
      catalogItemId: item.id,
      areaId: a1.id,
    });

    const moved = plantings.update(planting.id, { areaId: a2.id });
    expect(moved.areaId).toBe(a2.id);
  });

  test('rejects cross-garden area move on update', async () => {
    const db = await openTestDb();
    const g1 = bootstrapGardenWithSeason(db, { gardenName: 'Garden A' });
    const g2 = bootstrapGardenWithSeason(db, { gardenName: 'Garden B' });
    const areas = new GardenAreaRepository(db);
    const catalog = new PlantCatalogRepository(db);
    const plantings = new PlantingRepository(db);

    const areaB = areas.create({
      gardenId: g2.garden.id,
      name: 'B-area',
      type: 'garden_bed',
    });
    const item = catalog.create({
      gardenId: g1.garden.id,
      speciesName: 'Перец',
    });
    const planting = plantings.create({
      seasonId: g1.season.id,
      catalogItemId: item.id,
    });

    expect(() => plantings.update(planting.id, { areaId: areaB.id })).toThrow(
      /different gardens/
    );
  });

  test('copy creates an independent planting row', async () => {
    const db = await openTestDb();
    const { garden, season } = bootstrapGardenWithSeason(db, { gardenName: 'Дача' });
    const areas = new GardenAreaRepository(db);
    const catalog = new PlantCatalogRepository(db);
    const plantings = new PlantingRepository(db);

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
    const original = plantings.create({
      seasonId: season.id,
      catalogItemId: item.id,
      areaId: area.id,
      quantity: 6,
      quantityUnit: 'bushes',
    });

    const copied = plantings.copy(original.id);
    expect(copied.id).not.toBe(original.id);
    expect(copied.catalogItemId).toBe(original.catalogItemId);
    expect(copied.quantity).toBe(6);
    expect(plantings.listBySeason(season.id)).toHaveLength(2);
  });
});

describe('Phase 2 — catalog reuse', () => {
  test('reuses existing catalog item for matching species/variety', async () => {
    const db = await openTestDb();
    const { garden } = bootstrapGardenWithSeason(db, { gardenName: 'Дача' });
    const catalog = new PlantCatalogRepository(db);

    const first = catalog.create({
      gardenId: garden.id,
      speciesName: 'Томат',
      varietyName: 'Бычье сердце',
    });
    const resolved = resolveCatalogItemForPlanting(catalog, {
      gardenId: garden.id,
      speciesName: 'томат',
      varietyName: 'Бычье сердце',
    });

    expect(resolved.id).toBe(first.id);
    expect(catalog.listByGarden(garden.id)).toHaveLength(1);
  });

  test('editing one planting variety rebinds without renaming other plantings', async () => {
    const db = await openTestDb();
    const { garden, season } = bootstrapGardenWithSeason(db, { gardenName: 'Дача' });
    const catalog = new PlantCatalogRepository(db);
    const plantings = new PlantingRepository(db);

    const shared = catalog.create({
      gardenId: garden.id,
      speciesName: 'Томат',
      varietyName: 'Бычье сердце',
    });
    const p1 = plantings.create({
      seasonId: season.id,
      catalogItemId: shared.id,
    });
    const p2 = plantings.create({
      seasonId: season.id,
      catalogItemId: shared.id,
    });

    const newCatalog = resolveCatalogItemForPlanting(catalog, {
      gardenId: garden.id,
      speciesName: 'Томат',
      varietyName: 'Де Барао',
    });
    plantings.update(p1.id, { catalogItemId: newCatalog.id });

    expect(catalog.getById(shared.id)?.varietyName).toBe('Бычье сердце');
    expect(plantings.getById(p1.id)?.catalogItemId).toBe(newCatalog.id);
    expect(plantings.getById(p2.id)?.catalogItemId).toBe(shared.id);
  });
});

describe('Phase 2 — numeric parsing', () => {
  test('parses comma and dot decimals', () => {
    expect(parseFlexibleNumber('3')).toBe(3);
    expect(parseFlexibleNumber('3.5')).toBeCloseTo(3.5);
    expect(parseFlexibleNumber('3,5')).toBeCloseTo(3.5);
  });

  test('finalizePositiveNumber rejects zero and negative values', () => {
    expect(finalizePositiveNumber('3,5')).toBeCloseTo(3.5);
    expect(() => finalizePositiveNumber('0')).toThrow(/greater than zero/i);
    expect(() => finalizePositiveNumber('-1')).toThrow();
  });

  test('invalid complete numeric input throws', () => {
    expect(() => parseFlexibleNumber('abc')).toThrow();
  });
});
