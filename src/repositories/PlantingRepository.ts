/**
 * Planting repository — concrete planting in a season.
 */

import type { SqlDatabase } from '@/src/db/types';
import {
  PLANTING_STATUSES,
  QUANTITY_UNITS,
  type PlantingStatus,
  type QuantityUnit,
} from '@/src/domain/codes';
import { StorageError } from '@/src/domain/errors';
import type { LocalDate, Planting } from '@/src/domain/types';
import { isValidLocalDateString } from '@/src/utils/localDate';
import { createId } from '@/src/utils/id';
import { nowIsoUtc } from '@/src/utils/timestamps';

type PlantingRow = {
  id: string;
  season_id: string;
  area_id: string | null;
  catalog_item_id: string;
  quantity: number | null;
  quantity_unit: string | null;
  sowing_date: string | null;
  transplant_date: string | null;
  harvest_start_date: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CreatePlantingInput = {
  seasonId: string;
  catalogItemId: string;
  areaId?: string | null;
  quantity?: number | null;
  quantityUnit?: QuantityUnit | null;
  sowingDate?: LocalDate | null;
  transplantDate?: LocalDate | null;
  harvestStartDate?: LocalDate | null;
  status?: PlantingStatus;
  notes?: string | null;
};

export type UpdatePlantingInput = {
  areaId?: string | null;
  catalogItemId?: string;
  quantity?: number | null;
  quantityUnit?: QuantityUnit | null;
  sowingDate?: LocalDate | null;
  transplantDate?: LocalDate | null;
  harvestStartDate?: LocalDate | null;
  status?: PlantingStatus;
  notes?: string | null;
};

export class PlantingRepository {
  constructor(private readonly db: SqlDatabase) {}

  create(input: CreatePlantingInput): Planting {
    const status = input.status ?? 'planned';
    assertStatus(status);
    assertOptionalQuantityUnit(input.quantityUnit);
    assertOptionalLocalDate(input.sowingDate);
    assertOptionalLocalDate(input.transplantDate);
    assertOptionalLocalDate(input.harvestStartDate);

    const now = nowIsoUtc();
    const planting: Planting = {
      id: createId(),
      seasonId: input.seasonId,
      areaId: input.areaId ?? null,
      catalogItemId: input.catalogItemId,
      quantity: input.quantity ?? null,
      quantityUnit: input.quantityUnit ?? null,
      sowingDate: input.sowingDate ?? null,
      transplantDate: input.transplantDate ?? null,
      harvestStartDate: input.harvestStartDate ?? null,
      status,
      notes: emptyToNull(input.notes),
      createdAt: now,
      updatedAt: now,
    };

    try {
      this.db.run(
        `INSERT INTO plantings
         (id, season_id, area_id, catalog_item_id, quantity, quantity_unit,
          sowing_date, transplant_date, harvest_start_date, status, notes,
          created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          planting.id,
          planting.seasonId,
          planting.areaId,
          planting.catalogItemId,
          planting.quantity,
          planting.quantityUnit,
          planting.sowingDate,
          planting.transplantDate,
          planting.harvestStartDate,
          planting.status,
          planting.notes,
          planting.createdAt,
          planting.updatedAt,
        ]
      );
      return planting;
    } catch (err) {
      throw new StorageError('Failed to create planting', err);
    }
  }

  getById(id: string): Planting | null {
    try {
      const row = this.db.getFirst<PlantingRow>(
        `SELECT id, season_id, area_id, catalog_item_id, quantity, quantity_unit,
                sowing_date, transplant_date, harvest_start_date, status, notes,
                created_at, updated_at
         FROM plantings WHERE id = ?`,
        [id]
      );
      return row ? mapPlanting(row) : null;
    } catch (err) {
      throw new StorageError('Failed to get planting', err);
    }
  }

  listBySeason(seasonId: string): Planting[] {
    try {
      const rows = this.db.getAll<PlantingRow>(
        `SELECT id, season_id, area_id, catalog_item_id, quantity, quantity_unit,
                sowing_date, transplant_date, harvest_start_date, status, notes,
                created_at, updated_at
         FROM plantings
         WHERE season_id = ?
         ORDER BY created_at ASC`,
        [seasonId]
      );
      return rows.map(mapPlanting);
    } catch (err) {
      throw new StorageError('Failed to list plantings', err);
    }
  }

  update(id: string, input: UpdatePlantingInput): Planting {
    const existing = this.getById(id);
    if (!existing) {
      throw new StorageError(`Planting not found: ${id}`);
    }
    if (input.status !== undefined) {
      assertStatus(input.status);
    }
    assertOptionalQuantityUnit(input.quantityUnit);
    assertOptionalLocalDate(input.sowingDate);
    assertOptionalLocalDate(input.transplantDate);
    assertOptionalLocalDate(input.harvestStartDate);

    const next: Planting = {
      ...existing,
      areaId: input.areaId !== undefined ? input.areaId : existing.areaId,
      catalogItemId: input.catalogItemId ?? existing.catalogItemId,
      quantity: input.quantity !== undefined ? input.quantity : existing.quantity,
      quantityUnit:
        input.quantityUnit !== undefined ? input.quantityUnit : existing.quantityUnit,
      sowingDate:
        input.sowingDate !== undefined ? input.sowingDate : existing.sowingDate,
      transplantDate:
        input.transplantDate !== undefined
          ? input.transplantDate
          : existing.transplantDate,
      harvestStartDate:
        input.harvestStartDate !== undefined
          ? input.harvestStartDate
          : existing.harvestStartDate,
      status: input.status ?? existing.status,
      notes: input.notes !== undefined ? emptyToNull(input.notes) : existing.notes,
      updatedAt: nowIsoUtc(),
    };

    try {
      this.db.run(
        `UPDATE plantings
         SET area_id = ?, catalog_item_id = ?, quantity = ?, quantity_unit = ?,
             sowing_date = ?, transplant_date = ?, harvest_start_date = ?,
             status = ?, notes = ?, updated_at = ?
         WHERE id = ?`,
        [
          next.areaId,
          next.catalogItemId,
          next.quantity,
          next.quantityUnit,
          next.sowingDate,
          next.transplantDate,
          next.harvestStartDate,
          next.status,
          next.notes,
          next.updatedAt,
          id,
        ]
      );
      return next;
    } catch (err) {
      throw new StorageError('Failed to update planting', err);
    }
  }

  /**
   * Deletes a planting. Harvests CASCADE; task/event links SET NULL.
   */
  delete(id: string): boolean {
    try {
      const result = this.db.run(`DELETE FROM plantings WHERE id = ?`, [id]);
      return result.changes > 0;
    } catch (err) {
      throw new StorageError('Failed to delete planting', err);
    }
  }
}

function mapPlanting(row: PlantingRow): Planting {
  return {
    id: row.id,
    seasonId: row.season_id,
    areaId: row.area_id,
    catalogItemId: row.catalog_item_id,
    quantity: row.quantity,
    quantityUnit: row.quantity_unit as QuantityUnit | null,
    sowingDate: row.sowing_date,
    transplantDate: row.transplant_date,
    harvestStartDate: row.harvest_start_date,
    status: row.status as PlantingStatus,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function assertStatus(status: string): asserts status is PlantingStatus {
  if (!(PLANTING_STATUSES as readonly string[]).includes(status)) {
    throw new StorageError(`Invalid planting status: ${status}`);
  }
}

function assertOptionalQuantityUnit(
  unit: QuantityUnit | null | undefined
): void {
  if (unit === undefined || unit === null) return;
  if (!(QUANTITY_UNITS as readonly string[]).includes(unit)) {
    throw new StorageError(`Invalid quantity unit: ${unit}`);
  }
}

function assertOptionalLocalDate(value: LocalDate | null | undefined): void {
  if (value === undefined || value === null) return;
  if (!isValidLocalDateString(value)) {
    throw new StorageError(`Invalid local date: ${value}`);
  }
}

function emptyToNull(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}
