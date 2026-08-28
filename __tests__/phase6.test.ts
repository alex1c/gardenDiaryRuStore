/**
 * Phase 6 tests — expenses, money, stats, integrity.
 */

import initSqlJs from 'sql.js';

import { createDatabaseFromClient } from '@/src/db/database';
import { createSqlJsAdapter } from '@/src/db/sqlJsAdapter';
import type { SqlDatabase } from '@/src/db/types';
import { GardenAreaRepository } from '@/src/repositories/GardenAreaRepository';
import { ExpenseRepository } from '@/src/repositories/ExpenseRepository';
import { PlantCatalogRepository } from '@/src/repositories/PlantCatalogRepository';
import { PlantingRepository } from '@/src/repositories/PlantingRepository';
import { bootstrapGardenWithSeason } from '@/src/services/bootstrapGarden';
import { createHarvest } from '@/src/services/harvestService';
import { ExpenseStatsService } from '@/src/services/expenseStatsService';
import {
  finalizePositiveMoneyDraft,
  formatKopecksForDisplay,
  rublesToKopecks,
} from '@/src/utils/money';

async function openTestDb(): Promise<SqlDatabase> {
  const SQL = await initSqlJs();
  const raw = new SQL.Database();
  return createDatabaseFromClient(createSqlJsAdapter(raw));
}

type Fixture = {
  db: SqlDatabase;
  seasonId: string;
  areaId: string;
  plantingId: string;
  otherPlantingId: string;
};

async function seedFixture(): Promise<Fixture> {
  const db = await openTestDb();
  const { garden, season } = bootstrapGardenWithSeason(db, {
    gardenName: 'Dacha',
    year: 2026,
  });
  const areas = new GardenAreaRepository(db);
  const greenhouse = areas.create({
    gardenId: garden.id,
    name: 'Greenhouse',
    type: 'greenhouse',
  });
  const catalog = new PlantCatalogRepository(db);
  const tomato = catalog.create({
    gardenId: garden.id,
    speciesName: 'Tomato',
    varietyName: 'Bulls Heart',
  });
  const planting = new PlantingRepository(db).create({
    seasonId: season.id,
    areaId: greenhouse.id,
    catalogItemId: tomato.id,
  });

  const { garden: otherGarden, season: otherSeason } = bootstrapGardenWithSeason(db, {
    gardenName: 'Other',
    year: 2025,
  });
  const otherTomato = catalog.create({
    gardenId: otherGarden.id,
    speciesName: 'Cucumber',
  });
  const otherPlanting = new PlantingRepository(db).create({
    seasonId: otherSeason.id,
    catalogItemId: otherTomato.id,
  });

  return {
    db,
    seasonId: season.id,
    areaId: greenhouse.id,
    plantingId: planting.id,
    otherPlantingId: otherPlanting.id,
  };
}

describe('Expense CRUD', () => {
  test('create, edit, delete, backdated list', async () => {
    const { db, seasonId, areaId, plantingId } = await seedFixture();
    const expenses = new ExpenseRepository(db);

    const created = expenses.create({
      seasonId,
      date: '2026-05-05',
      category: 'fertilizers',
      amountKopecks: 89000,
      areaId,
      notes: 'NPK',
    });
    expect(created.amountKopecks).toBe(89000);

    const updated = expenses.update(created.id, {
      amountKopecks: 120050,
      category: 'seedlings',
      date: '2026-05-06',
      plantingId,
    });
    expect(updated.amountKopecks).toBe(120050);
    expect(updated.plantingId).toBe(plantingId);

    const listed = expenses.listBySeason(seasonId);
    expect(listed.map((item) => item.date)).toEqual(['2026-05-06']);

    expect(expenses.delete(updated.id)).toBe(true);
    expect(expenses.getById(updated.id)).toBeNull();
  });
});

describe('Expense integrity', () => {
  test('rejects planting from another season', async () => {
    const { db, seasonId, otherPlantingId } = await seedFixture();
    const expenses = new ExpenseRepository(db);
    expect(() =>
      expenses.create({
        seasonId,
        date: '2026-08-28',
        category: 'other',
        amountKopecks: 10000,
        plantingId: otherPlantingId,
      })
    ).toThrow(/different season/);
  });

  test('rejects cross-garden area', async () => {
    const { db, seasonId } = await seedFixture();
    const areas = new GardenAreaRepository(db);
    const { garden: foreignGarden } = bootstrapGardenWithSeason(db, {
      gardenName: 'Foreign',
      year: 2026,
    });
    const foreignArea = areas.create({
      gardenId: foreignGarden.id,
      name: 'Foreign bed',
      type: 'garden_bed',
    });

    const expenses = new ExpenseRepository(db);
    expect(() =>
      expenses.create({
        seasonId,
        date: '2026-08-28',
        category: 'tools',
        amountKopecks: 50000,
        areaId: foreignArea.id,
      })
    ).toThrow(/different garden/);
  });
});

describe('Expense stats', () => {
  test('totals by category and common area expenses', async () => {
    const { db, seasonId, areaId, plantingId } = await seedFixture();
    const expenses = new ExpenseRepository(db);
    expenses.create({
      seasonId,
      date: '2026-08-01',
      category: 'fertilizers',
      amountKopecks: 360000,
      areaId,
    });
    expenses.create({
      seasonId,
      date: '2026-08-02',
      category: 'seedlings',
      amountKopecks: 290000,
      plantingId,
    });
    expenses.create({
      seasonId,
      date: '2026-08-03',
      category: 'tools',
      amountKopecks: 298000,
    });

    const stats = new ExpenseStatsService(db);
    const summary = stats.getSeasonExpenseSummary(seasonId);
    expect(summary.totalKopecks).toBe(948000);
    expect(summary.displayTotal).toBe('9\u202f480 ₽');

    const categories = stats.getExpenseTotalsByCategory(seasonId);
    expect(categories[0]?.category).toBe('fertilizers');

    const areas = stats.getExpenseTotalsByArea(seasonId);
    expect(areas.areas.some((item) => item.areaId === areaId)).toBe(true);
    expect(areas.commonKopecks).toBe(298000);
  });

  test('season cost per kg uses weight harvest only', async () => {
    const { db, seasonId, plantingId } = await seedFixture();
    const expenses = new ExpenseRepository(db);
    expenses.create({
      seasonId,
      date: '2026-08-28',
      category: 'other',
      amountKopecks: 300000,
    });
    createHarvest(db, {
      seasonId,
      plantingId,
      date: '2026-08-28',
      quantity: 10,
      unit: 'kg',
    });
    createHarvest(db, {
      seasonId,
      plantingId,
      date: '2026-08-29',
      quantity: 50,
      unit: 'pcs',
    });

    const cost = new ExpenseStatsService(db).getSeasonCostPerKg(seasonId);
    expect(cost?.rublesPerKg).toBe(300);
  });

  test('planting cost uses only directly linked expenses', async () => {
    const { db, seasonId, plantingId } = await seedFixture();
    const expenses = new ExpenseRepository(db);
    expenses.create({
      seasonId,
      date: '2026-08-28',
      category: 'seedlings',
      amountKopecks: 120000,
      plantingId,
    });
    expenses.create({
      seasonId,
      date: '2026-08-28',
      category: 'tools',
      amountKopecks: 500000,
    });
    createHarvest(db, {
      seasonId,
      plantingId,
      date: '2026-08-28',
      quantity: 8,
      unit: 'kg',
    });

    const summary = new ExpenseStatsService(db).getPlantingExpenseSummary(plantingId);
    expect(summary?.totalKopecks).toBe(120000);
    expect(summary?.conditionalCostPerKg).toContain('150');
  });
});

describe('money utilities', () => {
  test('parses rubles to kopecks', () => {
    expect(finalizePositiveMoneyDraft('100')).toBe(10000);
    expect(finalizePositiveMoneyDraft('100,5')).toBe(10050);
    expect(finalizePositiveMoneyDraft('100.50')).toBe(10050);
  });

  test('rejects invalid money values', () => {
    expect(() => finalizePositiveMoneyDraft('0')).toThrow();
    expect(() => finalizePositiveMoneyDraft('-5')).toThrow();
    expect(() => finalizePositiveMoneyDraft('abc')).toThrow();
    expect(() => rublesToKopecks(Number.MAX_SAFE_INTEGER)).toThrow();
  });

  test('formats kopecks for display', () => {
    expect(formatKopecksForDisplay(89000)).toBe('890 ₽');
    expect(formatKopecksForDisplay(89050)).toBe('890,50 ₽');
    expect(formatKopecksForDisplay(124800000)).toBe('1\u202f248\u202f000 ₽');
  });
});
