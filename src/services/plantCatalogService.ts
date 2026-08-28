/**
 * Catalog resolution for plantings — reuse existing items, never mutate shared catalog
 * when the user edits a single planting's culture/variety.
 */

import type { PlantCatalogItem } from '@/src/domain/types';
import { PlantCatalogRepository } from '@/src/repositories/PlantCatalogRepository';

export type ResolveCatalogInput = {
  gardenId: string;
  speciesName: string;
  varietyName?: string | null;
  /** When set, reuse only if names still match this catalog row. */
  preferredCatalogItemId?: string | null;
};

/**
 * Finds an existing catalog item or creates a new one.
 * Does not update an existing catalog item in place.
 */
export function resolveCatalogItemForPlanting(
  catalogRepo: PlantCatalogRepository,
  input: ResolveCatalogInput
): PlantCatalogItem {
  const speciesName = input.speciesName.trim();
  if (!speciesName) {
    throw new Error('Species name is required');
  }
  const varietyName = normalizeVariety(input.varietyName);

  if (input.preferredCatalogItemId) {
    const preferred = catalogRepo.getById(input.preferredCatalogItemId);
    if (
      preferred &&
      preferred.gardenId === input.gardenId &&
      namesMatch(preferred, speciesName, varietyName)
    ) {
      return preferred;
    }
  }

  const existing = catalogRepo.findMatching(input.gardenId, speciesName, varietyName);
  if (existing) {
    return existing;
  }

  return catalogRepo.create({
    gardenId: input.gardenId,
    speciesName,
    varietyName,
  });
}

function normalizeVariety(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function namesMatch(
  item: PlantCatalogItem,
  speciesName: string,
  varietyName: string | null
): boolean {
  return (
    item.speciesName.localeCompare(speciesName, 'ru', { sensitivity: 'accent' }) ===
      0 &&
    (item.varietyName ?? null) === varietyName
  );
}
