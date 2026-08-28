/**
 * Phase 5 tests — harvest CRUD, stats, units, integrity, diary events.
 */

import initSqlJs from 'sql.js';

import { createDatabaseFromClient } from '@/src/db/database';
import { createSqlJsAdapter } from '@/src/db/sqlJsAdapter';
import type { SqlDatabase } from '@/src/db/types';
import { GardenAreaRepository } from '@/src/repositories/GardenAreaRepository';
import { GardenEventRepository } from '@/src/repositories/GardenEventRepository';
import { HarvestRepository } from '@/src/repositories/HarvestRepository';
import { PlantCatalogRepository } from '@/src/repositories/PlantCatalogRepository';
import { PlantingRepository } from '@/src/repositories/PlantingRepository';
import { bootstrapGardenWithSeason } from '@/src/services/bootstrapGarden';
import {
  aggregateMixedTotals,
  formatMixedTotals,
  formatWeightFromGrams,
  sumWeightGrams,
} from '@/src/services/harvestFormat';
import {
  createHarvest,
  deleteHarvest,
  updateHarvest,
} from '@/src/services/harvestService';
import { HarvestStatsService } from '@/src/services/harvestStatsService';

async function openTestDb(): Promise<SqlDatabase> {
  const SQL = await initSqlJs();
  const raw = new SQL.Database();
  return createDatabaseFromClient(createSqlJsAdapter(raw));
}

type Fixture = {
  db: SqlDatabase;
  seasonId: string;
  plantingId: string;
  otherSeasonId: string;
  otherPlantingId: string;
};

async function seedFixture(): Promise<Fixture> {
  const db = await openTestDb();
  const { garden, season } = bootstrapGardenWithSeason(db, {
    gardenName: 'Дача',
    year: 2026,
  });
  const areas = new GardenAreaRepository(db);
  const area = areas.create({
    gardenId: garden.id,
    name: 'Теплица',
    type: 'greenhouse',
  });
  const catalog = new PlantCatalogRepository(db);
  const item = catalog.create({
    gardenId: garden.id,
    speciesName: 'Tomato',
    varietyName: 'Bulls Heart',
  });
  const planting = new PlantingRepository(db).create({
    seasonId: season.id,
    areaId: area.id,
    catalogItemId: item.id,
    quantity: 6,
    quantityUnit: 'bushes',
  });

  const { garden: otherGarden, season: otherSeason } = bootstrapGardenWithSeason(db, {
    gardenName: 'Other',
    year: 2025,
  });
  const otherItem = new PlantCatalogRepository(db).create({
    gardenId: otherGarden.id,
    speciesName: 'Cucumber',
  });
  const otherPlanting = new PlantingRepository(db).create({
    seasonId: otherSeason.id,
    catalogItemId: otherItem.id,
  });

  return {
    db,
    seasonId: season.id,
    plantingId: planting.id,
    otherSeasonId: otherSeason.id,
    otherPlantingId: otherPlanting.id,
  };
}

describe('Harvest CRUD', () => {
  test('creates harvest with linked diary event', async () => {
    const { db, seasonId, plantingId } = await seedFixture();
    const result = createHarvest(db, {
      seasonId,
      plantingId,
      date: '2026-08-28',
      quantity: 2.4,
      unit: 'kg',
      notes: 'First pick',
    });

    expect(result.harvest.eventId).toBe(result.event.id);
    expect(result.event.type).toBe('harvesting');
    expect(result.event.title).toContain('2,4');
    expect(result.event.plantingId).toBe(plantingId);
  });

  test('updates harvest and syncs diary event', async () => {
    const { db, seasonId, plantingId } = await seedFixture();
    const { harvest, event } = createHarvest(db, {
      seasonId,
      plantingId,
      date: '2026-08-20',
      quantity: 2,
      unit: 'kg',
    });

    updateHarvest(db, harvest.id, {
      quantity: 3,
      unit: 'kg',
      date: '2026-08-21',
      notes: 'Updated',
    });

    const updatedEvent = new GardenEventRepository(db).getById(event.id);
    expect(updatedEvent?.title).toContain('3');
    expect(updatedEvent?.eventDate).toBe('2026-08-21');
    expect(updatedEvent?.notes).toBe('Updated');
  });

  test('delete removes harvest and linked event', async () => {
    const { db, seasonId, plantingId } = await seedFixture();
    const { harvest, event } = createHarvest(db, {
      seasonId,
      plantingId,
      date: '2026-08-28',
      quantity: 1,
      unit: 'kg',
    });

    expect(deleteHarvest(db, harvest.id)).toBe(true);
    expect(new HarvestRepository(db).getById(harvest.id)).toBeNull();
    expect(new GardenEventRepository(db).getById(event.id)).toBeNull();
  });

  test('listByPlanting returns backdated entries in date order', async () => {
    const { db, seasonId, plantingId } = await seedFixture();
    createHarvest(db, {
      seasonId,
      plantingId,
      date: '2026-08-28',
      quantity: 1,
      unit: 'kg',
    });
    createHarvest(db, {
      seasonId,
      plantingId,
      date: '2026-08-20',
      quantity: 2,
      unit: 'kg',
    });

    const listed = new HarvestRepository(db).listByPlanting(plantingId);
    expect(listed.map((h) => h.date)).toEqual(['2026-08-28', '2026-08-20']);
  });
});

describe('Harvest integrity', () => {
  test('rejects planting from another season', async () => {
    const { db, seasonId, otherPlantingId } = await seedFixture();
    expect(() =>
      createHarvest(db, {
        seasonId,
        plantingId: otherPlantingId,
        date: '2026-08-28',
        quantity: 1,
        unit: 'kg',
      })
    ).toThrow(/different season/);
  });

  test('rejects cross-garden planting on repository create', async () => {
    const { db, seasonId, otherPlantingId } = await seedFixture();
    expect(() =>
      new HarvestRepository(db).create({
        seasonId,
        plantingId: otherPlantingId,
        date: '2026-08-28',
        quantity: 1,
        unit: 'kg',
      })
    ).toThrow(/different/);
  });

  test('blocks direct edit of harvest-linked diary event', async () => {
    const { db, seasonId, plantingId } = await seedFixture();
    const { event } = createHarvest(db, {
      seasonId,
      plantingId,
      date: '2026-08-28',
      quantity: 1,
      unit: 'kg',
    });

    const events = new GardenEventRepository(db);
    expect(() => events.updateManual(event.id, { title: 'Hack' })).toThrow(
      /cannot be edited/
    );
    expect(() => events.deleteManual(event.id)).toThrow(/cannot be deleted/);
  });
});

describe('Harvest units and stats', () => {
  test('normalizes 1 kg + 500 g to 1.5 kg', () => {
    const grams = sumWeightGrams([
      { quantity: 1, unit: 'kg' },
      { quantity: 500, unit: 'g' },
    ]);
    expect(grams).toBe(1500);
    expect(formatWeightFromGrams(grams)).toBe('1,5 кг');
  });

  test('normalizes 250 g + 750 g to 1 kg', () => {
    const grams = sumWeightGrams([
      { quantity: 250, unit: 'g' },
      { quantity: 750, unit: 'g' },
    ]);
    expect(formatWeightFromGrams(grams)).toBe('1 кг');
  });

  test('keeps pcs separate from weight', () => {
    const mixed = aggregateMixedTotals([
      { quantity: 2, unit: 'kg' },
      { quantity: 7, unit: 'pcs' },
    ]);
    expect(formatMixedTotals(mixed)).toBe('2 кг · 7 шт.');
  });

  test('season stats by crop and variety', async () => {
    const { db, seasonId, plantingId } = await seedFixture();
    createHarvest(db, {
      seasonId,
      plantingId,
      date: '2026-08-28',
      quantity: 2.5,
      unit: 'kg',
    });
    createHarvest(db, {
      seasonId,
      plantingId,
      date: '2026-08-27',
      quantity: 500,
      unit: 'g',
    });

    const stats = new HarvestStatsService(db);
    const summary = stats.getSeasonHarvestSummary(seasonId);
    expect(summary.weightGrams).toBe(3000);
    expect(summary.totalsText).toBe('3 кг');

    const crops = stats.getCropTotals(seasonId);
    expect(crops[0]?.speciesName).toBe('Tomato');
    expect(crops[0]?.weightGrams).toBe(3000);

    const varieties = stats.getVarietyTotals(seasonId);
    expect(varieties[0]?.label).toBe('Bulls Heart');

    const plantingStats = stats.getPlantingTotals(seasonId);
    expect(plantingStats[0]?.yieldPerPlant).toContain('куст');
  });

  test('no yield-per-plant for rows unit', async () => {
    const { db, seasonId, plantingId } = await seedFixture();
    new PlantingRepository(db).update(plantingId, {
      quantity: 3,
      quantityUnit: 'rows',
    });
    createHarvest(db, {
      seasonId,
      plantingId,
      date: '2026-08-28',
      quantity: 1,
      unit: 'kg',
    });

    const summary = new HarvestStatsService(db).getPlantingHarvestSummary(plantingId);
    expect(summary?.yieldPerPlant).toBeNull();
  });
});
