/**
 * Garden repository — multi-plot ready even if UI v1 focuses on one.
 */

import type { SqlDatabase } from '@/src/db/types';
import { StorageError } from '@/src/domain/errors';
import type { Garden } from '@/src/domain/types';
import { createId } from '@/src/utils/id';
import { nowIsoUtc } from '@/src/utils/timestamps';

type GardenRow = {
  id: string;
  name: string;
  location_name: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateGardenInput = {
  name: string;
  locationName?: string | null;
  notes?: string | null;
};

export type UpdateGardenInput = {
  name?: string;
  locationName?: string | null;
  notes?: string | null;
};

export class GardenRepository {
  constructor(private readonly db: SqlDatabase) {}

  create(input: CreateGardenInput): Garden {
    const name = input.name.trim();
    if (!name) {
      throw new StorageError('Garden name is required');
    }

    const now = nowIsoUtc();
    const garden: Garden = {
      id: createId(),
      name,
      locationName: emptyToNull(input.locationName),
      notes: emptyToNull(input.notes),
      createdAt: now,
      updatedAt: now,
    };

    try {
      this.db.run(
        `INSERT INTO gardens (id, name, location_name, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          garden.id,
          garden.name,
          garden.locationName,
          garden.notes,
          garden.createdAt,
          garden.updatedAt,
        ]
      );
      return garden;
    } catch (err) {
      throw new StorageError('Failed to create garden', err);
    }
  }

  getById(id: string): Garden | null {
    try {
      const row = this.db.getFirst<GardenRow>(
        `SELECT id, name, location_name, notes, created_at, updated_at
         FROM gardens WHERE id = ?`,
        [id]
      );
      return row ? mapGarden(row) : null;
    } catch (err) {
      throw new StorageError('Failed to get garden', err);
    }
  }

  listAll(): Garden[] {
    try {
      const rows = this.db.getAll<GardenRow>(
        `SELECT id, name, location_name, notes, created_at, updated_at
         FROM gardens
         ORDER BY created_at ASC`
      );
      return rows.map(mapGarden);
    } catch (err) {
      throw new StorageError('Failed to list gardens', err);
    }
  }

  /** Convenience for UI v1 that assumes a single primary garden. */
  getPrimary(): Garden | null {
    const all = this.listAll();
    return all.length > 0 ? all[0] : null;
  }

  update(id: string, input: UpdateGardenInput): Garden {
    const existing = this.getById(id);
    if (!existing) {
      throw new StorageError(`Garden not found: ${id}`);
    }

    const next: Garden = {
      ...existing,
      name: input.name !== undefined ? input.name.trim() : existing.name,
      locationName:
        input.locationName !== undefined
          ? emptyToNull(input.locationName)
          : existing.locationName,
      notes: input.notes !== undefined ? emptyToNull(input.notes) : existing.notes,
      updatedAt: nowIsoUtc(),
    };

    if (!next.name) {
      throw new StorageError('Garden name is required');
    }

    try {
      this.db.run(
        `UPDATE gardens
         SET name = ?, location_name = ?, notes = ?, updated_at = ?
         WHERE id = ?`,
        [next.name, next.locationName, next.notes, next.updatedAt, id]
      );
      return next;
    } catch (err) {
      throw new StorageError('Failed to update garden', err);
    }
  }

  /**
   * Deletes a garden and cascades seasons / areas / catalog via FK.
   * Returns true if a row was deleted.
   */
  delete(id: string): boolean {
    try {
      const result = this.db.run(`DELETE FROM gardens WHERE id = ?`, [id]);
      return result.changes > 0;
    } catch (err) {
      throw new StorageError('Failed to delete garden', err);
    }
  }
}

function mapGarden(row: GardenRow): Garden {
  return {
    id: row.id,
    name: row.name,
    locationName: row.location_name,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function emptyToNull(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}
