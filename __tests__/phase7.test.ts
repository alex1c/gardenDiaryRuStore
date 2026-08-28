/**
 * Phase 7 tests — seasons, clone, perennials, comparison.
 */

import initSqlJs from 'sql.js';

import { createDatabaseFromClient } from '@/src/db/database';
import { runMigrations } from '@/src/db/migrate';
import { MIGRATIONS } from '@/src/db/migrations';
import { createSqlJsAdapter } from '@/src/db/sqlJsAdapter';
import type { SqlDatabase, SqlRunResult } from '@/src/db/types';
import { GardenRepository } from '@/src/repositories/GardenRepository';
import { GardenAreaRepository } from '@/src/repositories/GardenAreaRepository';
import { GardenEventRepository } from '@/src/repositories/GardenEventRepository';
import { GardenPhotoRepository } from '@/src/repositories/GardenPhotoRepository';
import { GardenPlantRepository } from '@/src/repositories/GardenPlantRepository';
import { GardenTaskRepository } from '@/src/repositories/GardenTaskRepository';
import { ExpenseRepository } from '@/src/repositories/ExpenseRepository';
import { HarvestRepository } from '@/src/repositories/HarvestRepository';
import { PlantCatalogRepository } from '@/src/repositories/PlantCatalogRepository';
import { PlantingRepository } from '@/src/repositories/PlantingRepository';
import { SeasonRepository } from '@/src/repositories/SeasonRepository';
import { SettingsRepository } from '@/src/repositories/SettingsRepository';
import { bootstrapGardenWithSeason } from '@/src/services/bootstrapGarden';
import { createHarvest } from '@/src/services/harvestService';
import { createPlantingWithOptionalPerennial } from '@/src/services/plantingService';
import {
  createSeasonWithOptions,
  transferPerennialsToSeason,
} from '@/src/services/seasonCloneService';
import {
  resolveActiveSeason,
  setActiveSeason,
} from '@/src/services/seasonContextService';
import { getSeasonComparison } from '@/src/services/seasonComparisonService';

async function openTestDb(): Promise<SqlDatabase> {
  const SQL = await initSqlJs();
  const raw = new SQL.Database();
  return createDatabaseFromClient(createSqlJsAdapter(raw));
}

async function openSchemaV3Db(): Promise<SqlDatabase> {
  const SQL = await initSqlJs();
  const raw = new SQL.Database();
  const db = createSqlJsAdapter(raw);
  db.exec('PRAGMA foreign_keys = ON;');
  runMigrations(db, MIGRATIONS.slice(0, 3));
  return db;
}

function failOnSql(db: SqlDatabase, pattern: RegExp): SqlDatabase {
  return {
    exec(sql: string): void {
      db.exec(sql);
    },
    run(sql: string, params?: unknown[]): SqlRunResult {
      if (pattern.test(sql)) {
        throw new Error('Simulated late clone failure');
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

type Fixture = {
  db: SqlDatabase;
  gardenId: string;
  season2026Id: string;
  areaId: string;
  catalogId: string;
};

async function seed2026(): Promise<Fixture> {
  const db = await openTestDb();
  const { garden, season } = bootstrapGardenWithSeason(db, {
    gardenName: 'Dacha',
    year: 2026,
  });
  const areas = new GardenAreaRepository(db);
  const area = areas.create({
    gardenId: garden.id,
    name: 'Garden bed',
    type: 'garden_bed',
  });
  const catalog = new PlantCatalogRepository(db);
  const tomato = catalog.create({
    gardenId: garden.id,
    speciesName: 'Apple',
    varietyName: 'Antonovka',
  });

  return {
    db,
    gardenId: garden.id,
    season2026Id: season.id,
    areaId: area.id,
    catalogId: tomato.id,
  };
}

describe('Migration v4', () => {
  test('upgrades v3 without losing existing data', async () => {
    const db = await openSchemaV3Db();
    const { garden, season } = bootstrapGardenWithSeason(db, {
      gardenName: 'Legacy garden',
      year: 2026,
    });
    const catalog = new PlantCatalogRepository(db).create({
      gardenId: garden.id,
      speciesName: 'Tomato',
    });
    const plantingId = 'legacy-planting';
    db.run(
      `INSERT INTO plantings
       (id, season_id, catalog_item_id, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [plantingId, season.id, catalog.id, 'growing', season.createdAt, season.updatedAt]
    );

    runMigrations(db);

    expect(db.getUserVersion()).toBe(4);
    expect(new GardenRepository(db).getById(garden.id)).not.toBeNull();
    expect(new SeasonRepository(db).getById(season.id)).not.toBeNull();
    expect(new PlantingRepository(db).getById(plantingId)?.gardenPlantId).toBeNull();
  });

  test('rolls back all v4 schema changes when the final unique index fails', async () => {
    const db = await openSchemaV3Db();
    const { garden, season } = bootstrapGardenWithSeason(db, {
      gardenName: 'Legacy garden',
      year: 2026,
    });
    db.run(
      `INSERT INTO seasons
       (id, garden_id, year, title, archived, created_at, updated_at)
       VALUES (?, ?, ?, ?, 0, ?, ?)`,
      ['duplicate-season', garden.id, season.year, 'Duplicate', season.createdAt, season.updatedAt]
    );

    expect(() => runMigrations(db)).toThrow(/Migration 4/);
    expect(db.getUserVersion()).toBe(3);
    expect(
      db.getFirst<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'garden_plants'"
      )
    ).toBeNull();
    expect(
      db.getAll<{ name: string }>('PRAGMA table_info(plantings)')
        .some((column) => column.name === 'garden_plant_id')
    ).toBe(false);
  });

  test('allows annual NULLs and the same perennial in different seasons', async () => {
    const { db, gardenId, season2026Id, catalogId } = await seed2026();
    const plantings = new PlantingRepository(db);
    plantings.create({ seasonId: season2026Id, catalogItemId: catalogId });
    plantings.create({ seasonId: season2026Id, catalogItemId: catalogId });

    const perennial = createPlantingWithOptionalPerennial(db, {
      seasonId: season2026Id,
      catalogItemId: catalogId,
      isPerennial: true,
    });
    const next = new SeasonRepository(db).create({
      gardenId,
      year: 2027,
      title: '2027',
    });

    expect(plantings.listBySeason(season2026Id)).toHaveLength(3);
    expect(() =>
      plantings.create({
        seasonId: season2026Id,
        catalogItemId: catalogId,
        gardenPlantId: perennial.gardenPlantId,
      })
    ).toThrow();
    expect(() =>
      plantings.create({
        seasonId: next.id,
        catalogItemId: catalogId,
        gardenPlantId: perennial.gardenPlantId,
      })
    ).not.toThrow();
  });
});

describe('Season create and active selection', () => {
  test('creates season and sets active via settings', async () => {
    const { db, gardenId } = await seed2026();
    const result = createSeasonWithOptions(db, {
      gardenId,
      year: 2027,
      title: 'Сезон 2027',
    });

    expect(result.season.year).toBe(2027);
    const active = resolveActiveSeason(db, gardenId);
    expect(active?.id).toBe(result.season.id);

    const settings = new SettingsRepository(db).getSettings();
    expect(settings.activeSeasonId).toBe(result.season.id);
  });

  test('rejects duplicate garden/year', async () => {
    const { db, gardenId } = await seed2026();
    expect(() =>
      createSeasonWithOptions(db, {
        gardenId,
        year: 2026,
        title: 'Duplicate',
      })
    ).toThrow(/already exists/);
  });

  test('deterministic fallback when settings missing', async () => {
    const { db, gardenId, season2026Id } = await seed2026();
    const seasons = new SeasonRepository(db);
    seasons.create({ gardenId, year: 2028, title: 'Future' });

    new SettingsRepository(db).patch({ activeSeasonId: null });
    const active = resolveActiveSeason(db, gardenId);
    expect(active?.year).toBe(2028);

    setActiveSeason(db, gardenId, season2026Id);
    expect(resolveActiveSeason(db, gardenId)?.id).toBe(season2026Id);
  });

  test('old season remains readable after new season', async () => {
    const { db, gardenId, season2026Id, catalogId } = await seed2026();
    const plantings = new PlantingRepository(db);
    plantings.create({
      seasonId: season2026Id,
      catalogItemId: catalogId,
      status: 'growing',
    });

    createSeasonWithOptions(db, {
      gardenId,
      year: 2027,
      title: 'Сезон 2027',
      setActive: true,
    });

    expect(new SeasonRepository(db).getById(season2026Id)).not.toBeNull();
    expect(plantings.listBySeason(season2026Id)).toHaveLength(1);
  });
});

describe('Season clone', () => {
  test('creates new season with perennials only by default', async () => {
    const { db, gardenId, season2026Id, areaId, catalogId } = await seed2026();
    const plantings = new PlantingRepository(db);

    const perennial = createPlantingWithOptionalPerennial(db, {
      seasonId: season2026Id,
      catalogItemId: catalogId,
      areaId,
      status: 'growing',
      isPerennial: true,
      transplantDate: '2020-05-01',
    });
    plantings.create({
      seasonId: season2026Id,
      catalogItemId: catalogId,
      status: 'growing',
    });

    const result = createSeasonWithOptions(db, {
      gardenId,
      year: 2027,
      title: 'Сезон 2027',
      sourceSeasonId: season2026Id,
      copyPerennials: true,
      copyAnnualPlantings: false,
    });

    const newPlantings = plantings.listBySeason(result.season.id);
    expect(result.perennialsCopied).toBe(1);
    expect(result.annualsCopied).toBe(0);
    expect(newPlantings).toHaveLength(1);
    expect(newPlantings[0].gardenPlantId).toBe(perennial.gardenPlantId);
    expect(newPlantings[0].sowingDate).toBeNull();
  });

  test('does not copy tasks, events, harvest, expenses, photos', async () => {
    const { db, gardenId, season2026Id, areaId, catalogId } = await seed2026();
    const plantings = new PlantingRepository(db);
    const planting = plantings.create({
      seasonId: season2026Id,
      catalogItemId: catalogId,
      areaId,
      status: 'growing',
    });

    new GardenTaskRepository(db).create({
      seasonId: season2026Id,
      title: 'Water',
      type: 'watering',
      dueDate: '2026-06-01',
    });
    new GardenEventRepository(db).create({
      seasonId: season2026Id,
      title: 'Note',
      type: 'other',
      eventDate: '2026-06-02',
      plantingId: planting.id,
    });
    createHarvest(db, {
      seasonId: season2026Id,
      plantingId: planting.id,
      date: '2026-08-01',
      quantity: 2,
      unit: 'kg',
    });
    new ExpenseRepository(db).create({
      seasonId: season2026Id,
      date: '2026-05-01',
      category: 'other',
      amountKopecks: 10000,
    });
    new GardenPhotoRepository(db).create({
      gardenId,
      seasonId: season2026Id,
      uri: 'file://photo.jpg',
    });

    const result = createSeasonWithOptions(db, {
      gardenId,
      year: 2027,
      title: 'Сезон 2027',
      sourceSeasonId: season2026Id,
      copyAnnualPlantings: true,
    });

    const sid = result.season.id;
    expect(new GardenTaskRepository(db).listBySeason(sid)).toHaveLength(0);
    expect(new GardenEventRepository(db).listBySeason(sid)).toHaveLength(0);
    expect(new HarvestRepository(db).listBySeason(sid)).toHaveLength(0);
    expect(new ExpenseRepository(db).listBySeason(sid)).toHaveLength(0);
    const photos = new GardenPhotoRepository(db).listByGarden(gardenId);
    expect(photos.filter((p) => p.seasonId === sid)).toHaveLength(0);
  });

  test('clone is idempotent for perennials', async () => {
    const { db, gardenId, season2026Id, catalogId } = await seed2026();
    createPlantingWithOptionalPerennial(db, {
      seasonId: season2026Id,
      catalogItemId: catalogId,
      isPerennial: true,
      status: 'growing',
    });

    const first = createSeasonWithOptions(db, {
      gardenId,
      year: 2027,
      title: 'Сезон 2027',
      sourceSeasonId: season2026Id,
      copyPerennials: true,
    });

    const plantings = new PlantingRepository(db);
    const source = plantings.listBySeason(season2026Id);
    const secondCount = transferPerennialsToSeason(
      plantings,
      source,
      first.season.id
    );

    expect(secondCount).toBe(0);
    expect(plantings.listBySeason(first.season.id)).toHaveLength(1);
  });

  test('rolls back copied rows and settings on a late clone failure', async () => {
    const { db, gardenId, season2026Id, catalogId } = await seed2026();
    createPlantingWithOptionalPerennial(db, {
      seasonId: season2026Id,
      catalogItemId: catalogId,
      isPerennial: true,
      status: 'growing',
    });

    new PlantingRepository(db).create({
      seasonId: season2026Id,
      catalogItemId: catalogId,
      status: 'growing',
    });
    const failingDb = failOnSql(db, /INSERT INTO app_settings/);

    expect(() =>
      createSeasonWithOptions(failingDb, {
        gardenId,
        year: 2027,
        title: 'Season 2027',
        sourceSeasonId: season2026Id,
        copyPerennials: true,
        copyAnnualPlantings: true,
      })
    ).toThrow(/Failed to save app settings/);

    expect(new SeasonRepository(db).getByGardenAndYear(gardenId, 2027)).toBeNull();
    expect(new PlantingRepository(db).listBySeason(season2026Id)).toHaveLength(2);
    expect(new SettingsRepository(db).getSettings().activeSeasonId).toBe(
      season2026Id
    );
  });
});

describe('Areas and catalog on clone', () => {
  test('does not duplicate garden areas or catalog items', async () => {
    const { db, gardenId, season2026Id, areaId, catalogId } = await seed2026();
    const areasBefore = new GardenAreaRepository(db).listByGarden(gardenId).length;
    const catalogBefore = new PlantCatalogRepository(db).listByGarden(gardenId).length;

    createSeasonWithOptions(db, {
      gardenId,
      year: 2027,
      title: 'Сезон 2027',
      sourceSeasonId: season2026Id,
      copyPerennials: true,
    });

    expect(new GardenAreaRepository(db).listByGarden(gardenId)).toHaveLength(
      areasBefore
    );
    expect(new GardenAreaRepository(db).getById(areaId)).not.toBeNull();
    expect(new PlantCatalogRepository(db).listByGarden(gardenId)).toHaveLength(
      catalogBefore
    );
    expect(new PlantCatalogRepository(db).getById(catalogId)).not.toBeNull();
  });
});

describe('GardenPlant perennials', () => {
  test('rejects invalid perennial values on update', async () => {
    const { db, season2026Id, catalogId } = await seed2026();
    const planting = createPlantingWithOptionalPerennial(db, {
      seasonId: season2026Id,
      catalogItemId: catalogId,
      isPerennial: true,
      quantity: 1,
    });
    const plants = new GardenPlantRepository(db);

    expect(() => plants.update(planting.gardenPlantId!, { quantity: -1 })).toThrow(
      /positive finite/
    );
    expect(() =>
      plants.update(planting.gardenPlantId!, { plantedDate: '2026-02-30' })
    ).toThrow(/Invalid local date/);
  });

  test('creates garden plant and links planting', async () => {
    const { db, season2026Id, catalogId } = await seed2026();
    const planting = createPlantingWithOptionalPerennial(db, {
      seasonId: season2026Id,
      catalogItemId: catalogId,
      isPerennial: true,
      status: 'growing',
      notes: 'Near fence',
    });

    expect(planting.gardenPlantId).not.toBeNull();
    const gardenPlant = new GardenPlantRepository(db).getById(planting.gardenPlantId!);
    expect(gardenPlant?.notes).toBe('Near fence');
  });

  test('next-season planting links same garden plant', async () => {
    const { db, gardenId, season2026Id, catalogId } = await seed2026();
    createPlantingWithOptionalPerennial(db, {
      seasonId: season2026Id,
      catalogItemId: catalogId,
      isPerennial: true,
      status: 'growing',
    });

    const result = createSeasonWithOptions(db, {
      gardenId,
      year: 2027,
      title: 'Сезон 2027',
      sourceSeasonId: season2026Id,
      copyPerennials: true,
    });

    const plantings = new PlantingRepository(db);
    const p2026 = plantings.listBySeason(season2026Id)[0];
    const p2027 = plantings.listBySeason(result.season.id)[0];
    expect(p2027.gardenPlantId).toBe(p2026.gardenPlantId);
  });

  test('unique season+gardenPlant prevents duplicate plantings', async () => {
    const { db, season2026Id, catalogId } = await seed2026();
    const planting = createPlantingWithOptionalPerennial(db, {
      seasonId: season2026Id,
      catalogItemId: catalogId,
      isPerennial: true,
      status: 'growing',
    });

    expect(() =>
      new PlantingRepository(db).create({
        seasonId: season2026Id,
        catalogItemId: catalogId,
        gardenPlantId: planting.gardenPlantId,
        status: 'growing',
      })
    ).toThrow();
  });

  test('area delete preserves garden plant identity', async () => {
    const { db, season2026Id, areaId, catalogId } = await seed2026();
    const planting = createPlantingWithOptionalPerennial(db, {
      seasonId: season2026Id,
      catalogItemId: catalogId,
      areaId,
      isPerennial: true,
      status: 'growing',
    });

    new GardenAreaRepository(db).delete(areaId);
    const gardenPlant = new GardenPlantRepository(db).getById(planting.gardenPlantId!);
    expect(gardenPlant).not.toBeNull();
    expect(gardenPlant?.areaId).toBeNull();
  });

  test('garden delete cleans garden plants', async () => {
    const { db, gardenId, season2026Id, catalogId } = await seed2026();
    const planting = createPlantingWithOptionalPerennial(db, {
      seasonId: season2026Id,
      catalogItemId: catalogId,
      isPerennial: true,
      status: 'growing',
    });

    new GardenRepository(db).delete(gardenId);

    expect(new GardenPlantRepository(db).getById(planting.gardenPlantId!)).toBeNull();
  });

  test('catalog delete restricted when garden plant uses it', async () => {
    const { db, season2026Id, catalogId } = await seed2026();
    createPlantingWithOptionalPerennial(db, {
      seasonId: season2026Id,
      catalogItemId: catalogId,
      isPerennial: true,
      status: 'growing',
    });

    expect(() => new PlantCatalogRepository(db).delete(catalogId)).toThrow();
  });

  test('cross-garden garden plant cannot link to planting', async () => {
    const { db, season2026Id, catalogId } = await seed2026();
    const other = bootstrapGardenWithSeason(db, { gardenName: 'Other', year: 2025 });
    const otherCatalog = new PlantCatalogRepository(db).create({
      gardenId: other.garden.id,
      speciesName: 'Pear',
    });
    const foreignPlant = new GardenPlantRepository(db).create({
      gardenId: other.garden.id,
      catalogItemId: otherCatalog.id,
      status: 'growing',
    });

    expect(() =>
      new PlantingRepository(db).create({
        seasonId: season2026Id,
        catalogItemId: catalogId,
        gardenPlantId: foreignPlant.id,
        status: 'growing',
      })
    ).toThrow(/different gardens/);
  });
});

describe('Season comparison', () => {
  test('season totals are independent', async () => {
    const { db, gardenId, season2026Id, catalogId } = await seed2026();
    const plantings = new PlantingRepository(db);
    const p2026 = plantings.create({
      seasonId: season2026Id,
      catalogItemId: catalogId,
      status: 'growing',
    });
    createHarvest(db, {
      seasonId: season2026Id,
      plantingId: p2026.id,
      date: '2026-08-01',
      quantity: 10,
      unit: 'kg',
    });
    new ExpenseRepository(db).create({
      seasonId: season2026Id,
      date: '2026-05-01',
      category: 'other',
      amountKopecks: 500000,
    });

    const result = createSeasonWithOptions(db, {
      gardenId,
      year: 2027,
      title: 'Сезон 2027',
      setActive: false,
    });
    const p2027 = plantings.create({
      seasonId: result.season.id,
      catalogItemId: catalogId,
      status: 'growing',
    });
    createHarvest(db, {
      seasonId: result.season.id,
      plantingId: p2027.id,
      date: '2027-08-01',
      quantity: 20,
      unit: 'kg',
    });

    const rows = getSeasonComparison(db, gardenId);
    expect(rows.length).toBeGreaterThanOrEqual(2);
    const row2026 = rows.find((r) => r.season.year === 2026)!;
    const row2027 = rows.find((r) => r.season.year === 2027)!;
    expect(row2026.harvestTotalsText).toContain('10');
    expect(row2027.harvestTotalsText).toContain('20');
    expect(row2026.expenseDisplayTotal).not.toBe(row2027.expenseDisplayTotal);
  });
});
