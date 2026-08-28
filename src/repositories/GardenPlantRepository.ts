/**
 * GardenPlant repository — garden-level perennial identity.
 */

import type { SqlDatabase } from '@/src/db/types';
import {
  PLANTING_STATUSES,
  QUANTITY_UNITS,
  type PlantingStatus,
  type QuantityUnit,
} from '@/src/domain/codes';
import { StorageError } from '@/src/domain/errors';
import type { GardenPlant, LocalDate } from '@/src/domain/types';
import { createId } from '@/src/utils/id';
import { isValidLocalDateString } from '@/src/utils/localDate';
import { nowIsoUtc } from '@/src/utils/timestamps';

type GardenPlantRow = {
  id: string;
  garden_id: string;
  area_id: string | null;
  catalog_item_id: string;
  name: string | null;
  quantity: number | null;
  quantity_unit: string | null;
  planted_date: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateGardenPlantInput = {
  gardenId: string;
  catalogItemId: string;
  areaId?: string | null;
  name?: string | null;
  quantity?: number | null;
  quantityUnit?: QuantityUnit | null;
  plantedDate?: LocalDate | null;
  status?: PlantingStatus;
  notes?: string | null;
};

export type UpdateGardenPlantInput = {
  areaId?: string | null;
  catalogItemId?: string;
  name?: string | null;
  quantity?: number | null;
  quantityUnit?: QuantityUnit | null;
  plantedDate?: LocalDate | null;
  status?: PlantingStatus;
  notes?: string | null;
};

export class GardenPlantRepository {
  constructor(private readonly db: SqlDatabase) {}

  create(input: CreateGardenPlantInput): GardenPlant {
    const status = input.status ?? 'growing';
    assertStatus(status);
    assertOptionalQuantityUnit(input.quantityUnit);
    assertOptionalLocalDate(input.plantedDate);
    assertOptionalPositiveFinite(input.quantity, 'Garden plant quantity');
    this.assertGardenConsistency(
      input.gardenId,
      input.catalogItemId,
      input.areaId ?? null
    );

    const now = nowIsoUtc();
    const plant: GardenPlant = {
      id: createId(),
      gardenId: input.gardenId,
      areaId: input.areaId ?? null,
      catalogItemId: input.catalogItemId,
      name: emptyToNull(input.name),
      quantity: input.quantity ?? null,
      quantityUnit: input.quantityUnit ?? null,
      plantedDate: input.plantedDate ?? null,
      status,
      notes: emptyToNull(input.notes),
      createdAt: now,
      updatedAt: now,
    };

    try {
      this.db.run(
        `INSERT INTO garden_plants
         (id, garden_id, area_id, catalog_item_id, name, quantity, quantity_unit,
          planted_date, status, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          plant.id,
          plant.gardenId,
          plant.areaId,
          plant.catalogItemId,
          plant.name,
          plant.quantity,
          plant.quantityUnit,
          plant.plantedDate,
          plant.status,
          plant.notes,
          plant.createdAt,
          plant.updatedAt,
        ]
      );
      return plant;
    } catch (err) {
      throw new StorageError('Failed to create garden plant', err);
    }
  }

  getById(id: string): GardenPlant | null {
    try {
      const row = this.db.getFirst<GardenPlantRow>(
        `SELECT * FROM garden_plants WHERE id = ?`,
        [id]
      );
      return row ? mapGardenPlant(row) : null;
    } catch (err) {
      throw new StorageError('Failed to read garden plant', err);
    }
  }

  listByGarden(gardenId: string): GardenPlant[] {
    try {
      const rows = this.db.getAll<GardenPlantRow>(
        `SELECT * FROM garden_plants WHERE garden_id = ? ORDER BY created_at ASC`,
        [gardenId]
      );
      return rows.map(mapGardenPlant);
    } catch (err) {
      throw new StorageError('Failed to list garden plants', err);
    }
  }

  update(id: string, input: UpdateGardenPlantInput): GardenPlant {
    const existing = this.getById(id);
    if (!existing) {
      throw new StorageError('Garden plant not found');
    }

    const next: GardenPlant = {
      ...existing,
      areaId: input.areaId !== undefined ? input.areaId : existing.areaId,
      catalogItemId: input.catalogItemId ?? existing.catalogItemId,
      name: input.name !== undefined ? emptyToNull(input.name) : existing.name,
      quantity: input.quantity !== undefined ? input.quantity : existing.quantity,
      quantityUnit:
        input.quantityUnit !== undefined ? input.quantityUnit : existing.quantityUnit,
      plantedDate:
        input.plantedDate !== undefined ? input.plantedDate : existing.plantedDate,
      status: input.status ?? existing.status,
      notes: input.notes !== undefined ? emptyToNull(input.notes) : existing.notes,
      updatedAt: nowIsoUtc(),
    };

    assertStatus(next.status);
    this.assertGardenConsistency(next.gardenId, next.catalogItemId, next.areaId);

    try {
      this.db.run(
        `UPDATE garden_plants SET
           area_id = ?, catalog_item_id = ?, name = ?, quantity = ?,
           quantity_unit = ?, planted_date = ?, status = ?, notes = ?, updated_at = ?
         WHERE id = ?`,
        [
          next.areaId,
          next.catalogItemId,
          next.name,
          next.quantity,
          next.quantityUnit,
          next.plantedDate,
          next.status,
          next.notes,
          next.updatedAt,
          id,
        ]
      );
      return next;
    } catch (err) {
      throw new StorageError('Failed to update garden plant', err);
    }
  }

  delete(id: string): boolean {
    try {
      const result = this.db.run(`DELETE FROM garden_plants WHERE id = ?`, [id]);
      return result.changes > 0;
    } catch (err) {
      throw new StorageError('Failed to delete garden plant', err);
    }
  }

  private assertGardenConsistency(
    gardenId: string,
    catalogItemId: string,
    areaId: string | null
  ): void {
    const row = this.db.getFirst<{
      catalog_garden_id: string;
      area_garden_id: string | null;
    }>(
      `SELECT c.garden_id AS catalog_garden_id, a.garden_id AS area_garden_id
       FROM plant_catalog_items c
       LEFT JOIN garden_areas a ON a.id = ?
       WHERE c.id = ?`,
      [areaId, catalogItemId]
    );

    if (!row) {
      throw new StorageError('Garden plant references a missing catalog item');
    }
    if (areaId !== null && row.area_garden_id === null) {
      throw new StorageError('Garden plant references a missing garden area');
    }
    if (row.catalog_garden_id !== gardenId) {
      throw new StorageError('Garden plant references catalog from a different garden');
    }
    if (areaId !== null && row.area_garden_id !== null && row.area_garden_id !== gardenId) {
      throw new StorageError('Garden plant references area from a different garden');
    }
  }
}

function mapGardenPlant(row: GardenPlantRow): GardenPlant {
  return {
    id: row.id,
    gardenId: row.garden_id,
    areaId: row.area_id,
    catalogItemId: row.catalog_item_id,
    name: row.name,
    quantity: row.quantity,
    quantityUnit: row.quantity_unit as QuantityUnit | null,
    plantedDate: row.planted_date,
    status: row.status as PlantingStatus,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function assertStatus(status: string): asserts status is PlantingStatus {
  if (!(PLANTING_STATUSES as readonly string[]).includes(status)) {
    throw new StorageError(`Invalid garden plant status: ${status}`);
  }
}

function assertOptionalQuantityUnit(unit: QuantityUnit | null | undefined): void {
  if (unit === undefined || unit === null) {
    return;
  }
  if (!(QUANTITY_UNITS as readonly string[]).includes(unit)) {
    throw new StorageError(`Invalid quantity unit: ${unit}`);
  }
}

function assertOptionalLocalDate(value: LocalDate | null | undefined): void {
  if (value === undefined || value === null) {
    return;
  }
  if (!isValidLocalDateString(value)) {
    throw new StorageError(`Invalid local date: ${value}`);
  }
}

function assertOptionalPositiveFinite(
  value: number | null | undefined,
  label: string
): void {
  if (value === undefined || value === null) {
    return;
  }
  if (!Number.isFinite(value) || value <= 0) {
    throw new StorageError(`${label} must be a positive finite number`);
  }
}

function emptyToNull(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}
