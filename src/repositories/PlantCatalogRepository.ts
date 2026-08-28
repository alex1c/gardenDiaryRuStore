/**
 * Plant catalog repository — species/variety reference, not a planting.
 */

import type { SqlDatabase } from '@/src/db/types';
import { StorageError } from '@/src/domain/errors';
import type { PlantCatalogItem } from '@/src/domain/types';
import { createId } from '@/src/utils/id';
import { nowIsoUtc } from '@/src/utils/timestamps';

type CatalogRow = {
  id: string;
  garden_id: string;
  species_name: string;
  variety_name: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateCatalogItemInput = {
  gardenId: string;
  speciesName: string;
  varietyName?: string | null;
  notes?: string | null;
};

export type UpdateCatalogItemInput = {
  speciesName?: string;
  varietyName?: string | null;
  notes?: string | null;
};

export class PlantCatalogRepository {
  constructor(private readonly db: SqlDatabase) {}

  create(input: CreateCatalogItemInput): PlantCatalogItem {
    const speciesName = input.speciesName.trim();
    if (!speciesName) {
      throw new StorageError('Species name is required');
    }

    const now = nowIsoUtc();
    const item: PlantCatalogItem = {
      id: createId(),
      gardenId: input.gardenId,
      speciesName,
      varietyName: emptyToNull(input.varietyName),
      notes: emptyToNull(input.notes),
      createdAt: now,
      updatedAt: now,
    };

    try {
      this.db.run(
        `INSERT INTO plant_catalog_items
         (id, garden_id, species_name, variety_name, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          item.id,
          item.gardenId,
          item.speciesName,
          item.varietyName,
          item.notes,
          item.createdAt,
          item.updatedAt,
        ]
      );
      return item;
    } catch (err) {
      throw new StorageError('Failed to create catalog item', err);
    }
  }

  getById(id: string): PlantCatalogItem | null {
    try {
      const row = this.db.getFirst<CatalogRow>(
        `SELECT id, garden_id, species_name, variety_name, notes, created_at, updated_at
         FROM plant_catalog_items WHERE id = ?`,
        [id]
      );
      return row ? mapCatalog(row) : null;
    } catch (err) {
      throw new StorageError('Failed to get catalog item', err);
    }
  }

  listByGarden(gardenId: string): PlantCatalogItem[] {
    try {
      const rows = this.db.getAll<CatalogRow>(
        `SELECT id, garden_id, species_name, variety_name, notes, created_at, updated_at
         FROM plant_catalog_items
         WHERE garden_id = ?
         ORDER BY species_name ASC, variety_name ASC`,
        [gardenId]
      );
      return rows.map(mapCatalog);
    } catch (err) {
      throw new StorageError('Failed to list catalog items', err);
    }
  }

  /**
   * Finds a catalog item by species/variety within a garden (case-insensitive trim).
   */
  findMatching(
    gardenId: string,
    speciesName: string,
    varietyName?: string | null
  ): PlantCatalogItem | null {
    const species = speciesName.trim();
    const variety = emptyToNull(varietyName);

    try {
      const rows = this.db.getAll<CatalogRow>(
        `SELECT id, garden_id, species_name, variety_name, notes, created_at, updated_at
         FROM plant_catalog_items
         WHERE garden_id = ?`,
        [gardenId]
      );

      const match = rows.find((row) => {
        const rowSpecies = row.species_name.trim();
        const rowVariety = row.variety_name;
        return (
          rowSpecies.localeCompare(species, 'ru', { sensitivity: 'accent' }) === 0 &&
          (rowVariety ?? null) === variety
        );
      });

      return match ? mapCatalog(match) : null;
    } catch (err) {
      throw new StorageError('Failed to find catalog item', err);
    }
  }

  update(id: string, input: UpdateCatalogItemInput): PlantCatalogItem {
    const existing = this.getById(id);
    if (!existing) {
      throw new StorageError(`Catalog item not found: ${id}`);
    }

    const next: PlantCatalogItem = {
      ...existing,
      speciesName:
        input.speciesName !== undefined
          ? input.speciesName.trim()
          : existing.speciesName,
      varietyName:
        input.varietyName !== undefined
          ? emptyToNull(input.varietyName)
          : existing.varietyName,
      notes: input.notes !== undefined ? emptyToNull(input.notes) : existing.notes,
      updatedAt: nowIsoUtc(),
    };

    if (!next.speciesName) {
      throw new StorageError('Species name is required');
    }

    try {
      this.db.run(
        `UPDATE plant_catalog_items
         SET species_name = ?, variety_name = ?, notes = ?, updated_at = ?
         WHERE id = ?`,
        [next.speciesName, next.varietyName, next.notes, next.updatedAt, id]
      );
      return next;
    } catch (err) {
      throw new StorageError('Failed to update catalog item', err);
    }
  }

  /**
   * Deletes a catalog item. Fails while plantings still reference it.
   */
  delete(id: string): boolean {
    try {
      const result = this.db.run(`DELETE FROM plant_catalog_items WHERE id = ?`, [id]);
      return result.changes > 0;
    } catch (err) {
      throw new StorageError('Failed to delete catalog item', err);
    }
  }
}

function mapCatalog(row: CatalogRow): PlantCatalogItem {
  return {
    id: row.id,
    gardenId: row.garden_id,
    speciesName: row.species_name,
    varietyName: row.variety_name,
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
