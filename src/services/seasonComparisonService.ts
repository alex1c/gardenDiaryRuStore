/**
 * Multi-season comparison using existing harvest/expense stats services.
 */

import type { SqlDatabase } from '@/src/db/types';
import type { Season } from '@/src/domain/types';
import { SeasonRepository } from '@/src/repositories/SeasonRepository';
import { ExpenseStatsService } from '@/src/services/expenseStatsService';
import { HarvestStatsService } from '@/src/services/harvestStatsService';

export type SeasonComparisonRow = {
  season: Season;
  harvestTotalsText: string | null;
  expenseDisplayTotal: string;
  conditionalCostPerKg: string | null;
};

export function getSeasonComparison(
  db: SqlDatabase,
  gardenId: string
): SeasonComparisonRow[] {
  const seasons = new SeasonRepository(db).listByGarden(gardenId);
  if (seasons.length < 2) {
    return [];
  }

  const harvestStats = new HarvestStatsService(db);
  const expenseStats = new ExpenseStatsService(db);

  return seasons.map((season) => {
    const harvest = harvestStats.getSeasonHarvestSummary(season.id);
    const expense = expenseStats.getSeasonExpenseSummary(season.id);
    const cost = expenseStats.getSeasonCostPerKg(season.id);

    return {
      season,
      harvestTotalsText: harvest.harvestCount > 0 ? harvest.totalsText : null,
      expenseDisplayTotal:
        expense.expenseCount > 0 ? expense.displayTotal : '0 ₽',
      conditionalCostPerKg: cost?.displayText ?? null,
    };
  });
}
