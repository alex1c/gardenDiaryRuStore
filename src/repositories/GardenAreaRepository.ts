/**
 * Garden area (zone) repository.
 */

import type { SqlDatabase } from '@/src/db/types';
import { GARDEN_AREA_TYPES, type GardenAreaType } from '@/src/domain/codes';
import { StorageError } from '@/src/domain/errors';
import type { GardenArea } from '@/src/domain/types';
import { createId } from '@/src/utils/id';
import { nowIsoUtc } from '@/src/utils/timestamps';

type AreaRow = {
  id: string;
  garden_id: string;
  name: string;
  type: string;
  length: number | null;
  width: number | null;
  notes: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type CreateAreaInput = {
  gardenId: string;
  name: string;
  type: GardenAreaType;
  length?: number | null;
  width?: number | null;
  notes?: string | null;
  sortOrder?: number;
};

export type UpdateAreaInput = {
  name?: string;
  type?: GardenAreaType;
  length?: number | null;
  width?: number | null;
  notes?: string | null;
  sortOrder?: number;
};

export class GardenAreaRepository {
  constructor(private readonly db: SqlDatabase) {}

  create(input: CreateAreaInput): GardenArea {
    const name = input.name.trim();
    if (!name) {
      throw new StorageError('Area name is required');
    }
    assertAreaType(input.type);

    const now = nowIsoUtc();
    const area: GardenArea = {
      id: createId(),
      gardenId: input.gardenId,
      name,
      type: input.type,
      length: input.length ?? null,
      width: input.width ?? null,
      notes: emptyToNull(input.notes),
      sortOrder: input.sortOrder ?? 0,
      createdAt: now,
      updatedAt: now,
    };

    try {
      this.db.run(
        `INSERT INTO garden_areas
         (id, garden_id, name, type, length, width, notes, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          area.id,
          area.gardenId,
          area.name,
          area.type,
          area.length,
          area.width,
          area.notes,
          area.sortOrder,
          area.createdAt,
          area.updatedAt,
        ]
      );
      return area;
    } catch (err) {
      throw new StorageError('Failed to create garden area', err);
    }
  }

  getById(id: string): GardenArea | null {
    try {
      const row = this.db.getFirst<AreaRow>(
        `SELECT id, garden_id, name, type, length, width, notes, sort_order, created_at, updated_at
         FROM garden_areas WHERE id = ?`,
        [id]
      );
      return row ? mapArea(row) : null;
    } catch (err) {
      throw new StorageError('Failed to get garden area', err);
    }
  }

  listByGarden(gardenId: string): GardenArea[] {
    try {
      const rows = this.db.getAll<AreaRow>(
        `SELECT id, garden_id, name, type, length, width, notes, sort_order, created_at, updated_at
         FROM garden_areas
         WHERE garden_id = ?
         ORDER BY sort_order ASC, created_at ASC`,
        [gardenId]
      );
      return rows.map(mapArea);
    } catch (err) {
      throw new StorageError('Failed to list garden areas', err);
    }
  }

  update(id: string, input: UpdateAreaInput): GardenArea {
    const existing = this.getById(id);
    if (!existing) {
      throw new StorageError(`Garden area not found: ${id}`);
    }
    if (input.type !== undefined) {
      assertAreaType(input.type);
    }

    const next: GardenArea = {
      ...existing,
      name: input.name !== undefined ? input.name.trim() : existing.name,
      type: input.type ?? existing.type,
      length: input.length !== undefined ? input.length : existing.length,
      width: input.width !== undefined ? input.width : existing.width,
      notes: input.notes !== undefined ? emptyToNull(input.notes) : existing.notes,
      sortOrder: input.sortOrder !== undefined ? input.sortOrder : existing.sortOrder,
      updatedAt: nowIsoUtc(),
    };

    if (!next.name) {
      throw new StorageError('Area name is required');
    }

    try {
      this.db.run(
        `UPDATE garden_areas
         SET name = ?, type = ?, length = ?, width = ?, notes = ?, sort_order = ?, updated_at = ?
         WHERE id = ?`,
        [
          next.name,
          next.type,
          next.length,
          next.width,
          next.notes,
          next.sortOrder,
          next.updatedAt,
          id,
        ]
      );
      return next;
    } catch (err) {
      throw new StorageError('Failed to update garden area', err);
    }
  }

  /**
   * Deletes an area. Related plantings/tasks/events keep history with area_id = NULL.
   */
  delete(id: string): boolean {
    try {
      const result = this.db.run(`DELETE FROM garden_areas WHERE id = ?`, [id]);
      return result.changes > 0;
    } catch (err) {
      throw new StorageError('Failed to delete garden area', err);
    }
  }
}

function mapArea(row: AreaRow): GardenArea {
  return {
    id: row.id,
    gardenId: row.garden_id,
    name: row.name,
    type: row.type as GardenAreaType,
    length: row.length,
    width: row.width,
    notes: row.notes,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function assertAreaType(type: string): asserts type is GardenAreaType {
  if (!(GARDEN_AREA_TYPES as readonly string[]).includes(type)) {
    throw new StorageError(`Invalid garden area type: ${type}`);
  }
}

function emptyToNull(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}
