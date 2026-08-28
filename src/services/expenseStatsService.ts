/**
 * Expense statistics — computed at read time from integer kopecks.
 */

import type { SqlDatabase } from '@/src/db/types';
import type { ExpenseCategory } from '@/src/domain/codes';
import { EXPENSE_CATEGORY_LABELS } from '@/src/domain/codes';
import type { Expense } from '@/src/domain/types';
import { ExpenseRepository } from '@/src/repositories/ExpenseRepository';
import { HarvestStatsService } from '@/src/services/harvestStatsService';
import { formatKopecksForDisplay, kopecksToRubles } from '@/src/utils/money';

export type SeasonExpenseSummary = {
  totalKopecks: number;
  displayTotal: string;
  expenseCount: number;
};

export type CategoryExpenseTotal = {
  category: ExpenseCategory;
  label: string;
  totalKopecks: number;
  displayTotal: string;
};

export type AreaExpenseTotal = {
  areaId: string;
  areaName: string;
  totalKopecks: number;
  displayTotal: string;
};

export type PlantingExpenseSummary = {
  plantingId: string;
  label: string;
  areaName: string | null;
  totalKopecks: number;
  displayTotal: string;
  harvestTotalsText: string | null;
  conditionalCostPerKg: string | null;
};

export type SeasonCostPerKg = {
  rublesPerKg: number;
  displayText: string;
};

export class ExpenseStatsService {
  private readonly expenseRepo: ExpenseRepository;

  constructor(private readonly db: SqlDatabase) {
    this.expenseRepo = new ExpenseRepository(db);
  }

  getSeasonExpenseSummary(seasonId: string): SeasonExpenseSummary {
    const expenses = this.expenseRepo.listBySeason(seasonId);
    const totalKopecks = this.expenseRepo.totalBySeason(seasonId);
    return {
      totalKopecks,
      displayTotal: formatKopecksForDisplay(totalKopecks),
      expenseCount: expenses.length,
    };
  }

  getExpenseTotalsByCategory(seasonId: string): CategoryExpenseTotal[] {
    return this.expenseRepo.totalsByCategory(seasonId).map((row) => ({
      category: row.category,
      label: EXPENSE_CATEGORY_LABELS[row.category],
      totalKopecks: row.totalKopecks,
      displayTotal: formatKopecksForDisplay(row.totalKopecks),
    }));
  }

  getExpenseTotalsByArea(seasonId: string): {
    areas: AreaExpenseTotal[];
    commonKopecks: number;
    commonDisplayTotal: string | null;
  } {
    const areas = this.expenseRepo.totalsByArea(seasonId).map((row) => ({
      areaId: row.areaId,
      areaName: row.areaName,
      totalKopecks: row.totalKopecks,
      displayTotal: formatKopecksForDisplay(row.totalKopecks),
    }));
    const commonKopecks = this.expenseRepo.totalCommonExpenses(seasonId);
    return {
      areas,
      commonKopecks,
      commonDisplayTotal:
        commonKopecks > 0 ? formatKopecksForDisplay(commonKopecks) : null,
    };
  }

  getPlantingExpenseSummaries(seasonId: string): PlantingExpenseSummary[] {
    const totals = this.expenseRepo.totalsByPlanting(seasonId);
    const harvestService = new HarvestStatsService(this.db);

    return totals.map((row) => {
      const catalogRow = this.db.getFirst<{
        species_name: string;
        variety_name: string | null;
        area_name: string | null;
      }>(
        `SELECT c.species_name, c.variety_name, a.name AS area_name
         FROM plantings p
         JOIN plant_catalog_items c ON c.id = p.catalog_item_id
         LEFT JOIN garden_areas a ON a.id = p.area_id
         WHERE p.id = ?`,
        [row.plantingId]
      );

      const label = catalogRow
        ? catalogRow.variety_name
          ? `${catalogRow.species_name} · ${catalogRow.variety_name}`
          : catalogRow.species_name
        : 'Посадка';

      const harvestSummary = harvestService.getPlantingHarvestSummary(row.plantingId);

      return {
        plantingId: row.plantingId,
        label,
        areaName: catalogRow?.area_name ?? null,
        totalKopecks: row.totalKopecks,
        displayTotal: formatKopecksForDisplay(row.totalKopecks),
        harvestTotalsText: harvestSummary?.totalsText ?? null,
        conditionalCostPerKg: formatConditionalCostPerKg(
          row.totalKopecks,
          harvestSummary?.weightGrams ?? 0
        ),
      };
    });
  }

  getPlantingExpenseSummary(plantingId: string): {
    totalKopecks: number;
    displayTotal: string;
    conditionalCostPerKg: string | null;
    harvestTotalsText: string | null;
  } | null {
    const expenses = this.expenseRepo.listByPlanting(plantingId);
    if (expenses.length === 0) {
      return null;
    }

    const totalKopecks = expenses.reduce(
      (sum, expense) => sum + expense.amountKopecks,
      0
    );
    const harvestSummary = new HarvestStatsService(this.db).getPlantingHarvestSummary(
      plantingId
    );

    return {
      totalKopecks,
      displayTotal: formatKopecksForDisplay(totalKopecks),
      harvestTotalsText: harvestSummary?.totalsText ?? null,
      conditionalCostPerKg: formatConditionalCostPerKg(
        totalKopecks,
        harvestSummary?.weightGrams ?? 0
      ),
    };
  }

  /**
   * Season-level conditional ₽/kg using total expenses and weight harvest only.
   * Returns null when there is no weight harvest.
   */
  getSeasonCostPerKg(seasonId: string): SeasonCostPerKg | null {
    const totalKopecks = this.expenseRepo.totalBySeason(seasonId);
    if (totalKopecks <= 0) {
      return null;
    }

    const harvestSummary = new HarvestStatsService(this.db).getSeasonHarvestSummary(
      seasonId
    );
    if (harvestSummary.weightGrams <= 0) {
      return null;
    }

    const rublesPerKg = computeRublesPerKg(totalKopecks, harvestSummary.weightGrams);
    return {
      rublesPerKg,
      displayText: `Условно: ${formatRublesPerKg(rublesPerKg)} на 1 кг урожая`,
    };
  }

  /** Groups expenses by local date for history screens. */
  groupExpensesByDate(
    expenses: Expense[]
  ): { date: string; expenses: Expense[] }[] {
    const map = new Map<string, Expense[]>();
    for (const expense of expenses) {
      const list = map.get(expense.date) ?? [];
      list.push(expense);
      map.set(expense.date, list);
    }

    return [...map.entries()]
      .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
      .map(([date, dateExpenses]) => ({ date, expenses: dateExpenses }));
  }
}

function formatConditionalCostPerKg(
  totalKopecks: number,
  weightGrams: number
): string | null {
  if (totalKopecks <= 0 || weightGrams <= 0) {
    return null;
  }
  const rublesPerKg = computeRublesPerKg(totalKopecks, weightGrams);
  return `Условно: ${formatRublesPerKg(rublesPerKg)}/кг`;
}

function computeRublesPerKg(totalKopecks: number, weightGrams: number): number {
  const harvestedKg = weightGrams / 1000;
  const expenseRubles = kopecksToRubles(totalKopecks);
  return Math.round((expenseRubles / harvestedKg) * 100) / 100;
}

function formatRublesPerKg(rublesPerKg: number): string {
  const text = Number.isInteger(rublesPerKg)
    ? String(rublesPerKg)
    : rublesPerKg.toFixed(2).replace('.', ',');
  return `${text.replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f')} ₽`;
}
