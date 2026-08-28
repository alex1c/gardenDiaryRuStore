/**
 * Harvest statistics — computed at read time, never persisted.
 *
 * Aggregation rules:
 * - kg + g → integer grams internally;
 * - pcs summed separately;
 * - weight and pieces never merged into one number.
 */

import type { SqlDatabase } from '@/src/db/types';
import type { HarvestUnit, QuantityUnit } from '@/src/domain/codes';
import type { Harvest, LocalDate } from '@/src/domain/types';
import { HarvestRepository } from '@/src/repositories/HarvestRepository';
import { PlantingRepository } from '@/src/repositories/PlantingRepository';
import {
  aggregateMixedTotals,
  computeYieldPerPlant,
  formatMixedTotals,
  sumWeightGrams,
} from '@/src/services/harvestFormat';

export type SeasonHarvestSummary = {
  totalsText: string | null;
  weightGrams: number;
  pieceCount: number;
  harvestCount: number;
};

export type CropTotal = {
  speciesName: string;
  weightGrams: number;
  pieceCount: number;
  displayTotal: string;
};

export type VarietyTotal = {
  speciesName: string;
  varietyName: string | null;
  label: string;
  weightGrams: number;
  pieceCount: number;
  displayTotal: string;
};

export type PlantingHarvestSummary = {
  plantingId: string;
  speciesName: string;
  varietyName: string | null;
  areaName: string | null;
  label: string;
  totalsText: string | null;
  weightGrams: number;
  pieceCount: number;
  yieldPerPlant: string | null;
  recentHarvests: Harvest[];
};

export type TodayHarvestLine = {
  label: string;
  totalsText: string;
};

type HarvestRow = Pick<Harvest, 'quantity' | 'unit'>;

export class HarvestStatsService {
  private readonly harvestRepo: HarvestRepository;
  private readonly plantingRepo: PlantingRepository;

  constructor(private readonly db: SqlDatabase) {
    this.harvestRepo = new HarvestRepository(db);
    this.plantingRepo = new PlantingRepository(db);
  }

  getSeasonHarvestSummary(seasonId: string): SeasonHarvestSummary {
    const harvests = this.harvestRepo.listBySeason(seasonId);
    const mixed = aggregateMixedTotals(harvests);
    return {
      totalsText: formatMixedTotals(mixed),
      weightGrams: mixed.weight?.grams ?? 0,
      pieceCount: mixed.pieces?.pieces ?? 0,
      harvestCount: harvests.length,
    };
  }

  getCropTotals(seasonId: string): CropTotal[] {
    const rows = this.db.getAll<{
      species_name: string;
      quantity: number;
      unit: string;
    }>(
      `SELECT c.species_name, h.quantity, h.unit
       FROM harvests h
       JOIN plantings p ON p.id = h.planting_id
       JOIN plant_catalog_items c ON c.id = p.catalog_item_id
       WHERE h.season_id = ?
       ORDER BY c.species_name`,
      [seasonId]
    );

    const bySpecies = new Map<string, HarvestRow[]>();
    for (const row of rows) {
      const list = bySpecies.get(row.species_name) ?? [];
      list.push({ quantity: row.quantity, unit: row.unit as HarvestUnit });
      bySpecies.set(row.species_name, list);
    }

    return [...bySpecies.entries()]
      .map(([speciesName, harvestRows]) => {
        const mixed = aggregateMixedTotals(harvestRows);
        return {
          speciesName,
          weightGrams: mixed.weight?.grams ?? 0,
          pieceCount: mixed.pieces?.pieces ?? 0,
          displayTotal: formatMixedTotals(mixed) ?? '',
        };
      })
      .filter((item) => item.displayTotal.length > 0)
      .sort((a, b) => b.weightGrams - a.weightGrams || b.pieceCount - a.pieceCount);
  }

  getVarietyTotals(seasonId: string): VarietyTotal[] {
    const rows = this.db.getAll<{
      species_name: string;
      variety_name: string | null;
      quantity: number;
      unit: string;
    }>(
      `SELECT c.species_name, c.variety_name, h.quantity, h.unit
       FROM harvests h
       JOIN plantings p ON p.id = h.planting_id
       JOIN plant_catalog_items c ON c.id = p.catalog_item_id
       WHERE h.season_id = ?
       ORDER BY c.species_name, c.variety_name`,
      [seasonId]
    );

    const byKey = new Map<string, HarvestRow[]>();
    const meta = new Map<string, { speciesName: string; varietyName: string | null }>();

    for (const row of rows) {
      const key = `${row.species_name}\0${row.variety_name ?? ''}`;
      const list = byKey.get(key) ?? [];
      list.push({ quantity: row.quantity, unit: row.unit as HarvestUnit });
      byKey.set(key, list);
      meta.set(key, {
        speciesName: row.species_name,
        varietyName: row.variety_name,
      });
    }

    return [...byKey.entries()]
      .map(([key, harvestRows]) => {
        const info = meta.get(key)!;
        const mixed = aggregateMixedTotals(harvestRows);
        const label = info.varietyName
          ? info.varietyName
          : info.speciesName;
        return {
          speciesName: info.speciesName,
          varietyName: info.varietyName,
          label,
          weightGrams: mixed.weight?.grams ?? 0,
          pieceCount: mixed.pieces?.pieces ?? 0,
          displayTotal: formatMixedTotals(mixed) ?? '',
        };
      })
      .filter((item) => item.displayTotal.length > 0)
      .sort((a, b) => b.weightGrams - a.weightGrams || b.pieceCount - a.pieceCount);
  }

  getPlantingTotals(seasonId: string): PlantingHarvestSummary[] {
    const rows = this.db.getAll<{
      planting_id: string;
      species_name: string;
      variety_name: string | null;
      area_name: string | null;
      quantity: number;
      unit: string;
      planting_quantity: number | null;
      planting_quantity_unit: string | null;
    }>(
      `SELECT h.planting_id, c.species_name, c.variety_name, a.name AS area_name,
              h.quantity, h.unit, p.quantity AS planting_quantity,
              p.quantity_unit AS planting_quantity_unit
       FROM harvests h
       JOIN plantings p ON p.id = h.planting_id
       JOIN plant_catalog_items c ON c.id = p.catalog_item_id
       LEFT JOIN garden_areas a ON a.id = p.area_id
       WHERE h.season_id = ?`,
      [seasonId]
    );

    const byPlanting = new Map<
      string,
      {
        speciesName: string;
        varietyName: string | null;
        areaName: string | null;
        plantingQuantity: number | null;
        plantingQuantityUnit: QuantityUnit | null;
        harvestRows: HarvestRow[];
      }
    >();

    for (const row of rows) {
      const entry = byPlanting.get(row.planting_id) ?? {
        speciesName: row.species_name,
        varietyName: row.variety_name,
        areaName: row.area_name,
        plantingQuantity: row.planting_quantity,
        plantingQuantityUnit: row.planting_quantity_unit as QuantityUnit | null,
        harvestRows: [],
      };
      entry.harvestRows.push({
        quantity: row.quantity,
        unit: row.unit as HarvestUnit,
      });
      byPlanting.set(row.planting_id, entry);
    }

    return [...byPlanting.entries()]
      .map(([plantingId, info]) => {
        const mixed = aggregateMixedTotals(info.harvestRows);
        const weightGrams = mixed.weight?.grams ?? 0;
        const label = info.varietyName
          ? `${info.speciesName} · ${info.varietyName}`
          : info.speciesName;
        return {
          plantingId,
          speciesName: info.speciesName,
          varietyName: info.varietyName,
          areaName: info.areaName,
          label,
          totalsText: formatMixedTotals(mixed),
          weightGrams,
          pieceCount: mixed.pieces?.pieces ?? 0,
          yieldPerPlant: computeYieldPerPlant(
            weightGrams,
            info.plantingQuantity,
            info.plantingQuantityUnit
          ),
          recentHarvests: this.harvestRepo.listByPlanting(plantingId, 5),
        };
      })
      .sort((a, b) => b.weightGrams - a.weightGrams || b.pieceCount - a.pieceCount);
  }

  getPlantingHarvestSummary(plantingId: string): PlantingHarvestSummary | null {
    const planting = this.plantingRepo.getById(plantingId);
    if (!planting) {
      return null;
    }

    const catalogRow = this.db.getFirst<{
      species_name: string;
      variety_name: string | null;
    }>(
      `SELECT species_name, variety_name FROM plant_catalog_items WHERE id = ?`,
      [planting.catalogItemId]
    );
    if (!catalogRow) {
      return null;
    }

    const areaName = planting.areaId
      ? this.db.getFirst<{ name: string }>(
          `SELECT name FROM garden_areas WHERE id = ?`,
          [planting.areaId]
        )?.name ?? null
      : null;

    const harvests = this.harvestRepo.listByPlanting(plantingId);
    const mixed = aggregateMixedTotals(harvests);
    const weightGrams = mixed.weight?.grams ?? 0;
    const label = catalogRow.variety_name
      ? `${catalogRow.species_name} · ${catalogRow.variety_name}`
      : catalogRow.species_name;

    return {
      plantingId,
      speciesName: catalogRow.species_name,
      varietyName: catalogRow.variety_name,
      areaName,
      label,
      totalsText: formatMixedTotals(mixed),
      weightGrams,
      pieceCount: mixed.pieces?.pieces ?? 0,
      yieldPerPlant: computeYieldPerPlant(
        weightGrams,
        planting.quantity,
        planting.quantityUnit
      ),
      recentHarvests: harvests.slice(0, 5),
    };
  }

  getTodayHarvestLines(seasonId: string, date: LocalDate): TodayHarvestLine[] {
    const rows = this.db.getAll<{
      species_name: string;
      variety_name: string | null;
      quantity: number;
      unit: string;
    }>(
      `SELECT c.species_name, c.variety_name, h.quantity, h.unit
       FROM harvests h
       JOIN plantings p ON p.id = h.planting_id
       JOIN plant_catalog_items c ON c.id = p.catalog_item_id
       WHERE h.season_id = ? AND h.date = ?`,
      [seasonId, date]
    );

    const byCulture = new Map<string, HarvestRow[]>();
    for (const row of rows) {
      const label = row.variety_name
        ? `${row.species_name} · ${row.variety_name}`
        : row.species_name;
      const list = byCulture.get(label) ?? [];
      list.push({ quantity: row.quantity, unit: row.unit as HarvestUnit });
      byCulture.set(label, list);
    }

    return [...byCulture.entries()]
      .map(([label, harvestRows]) => {
        const mixed = aggregateMixedTotals(harvestRows);
        return {
          label,
          totalsText: formatMixedTotals(mixed) ?? '',
        };
      })
      .filter((line) => line.totalsText.length > 0);
  }

  /** Sums weight harvests for a date (grams). Used internally by tests. */
  sumWeightForDate(seasonId: string, date: LocalDate): number {
    const harvests = this.harvestRepo.listByDateRange(seasonId, date, date);
    return sumWeightGrams(harvests);
  }
}
