/**
 * Planting creation with optional garden-level perennial identity.
 */

import type { SqlDatabase } from '@/src/db/types';
import { StorageError } from '@/src/domain/errors';
import type { Planting } from '@/src/domain/types';
import {
  GardenPlantRepository,
  type CreateGardenPlantInput,
} from '@/src/repositories/GardenPlantRepository';
import {
  PlantingRepository,
  type CreatePlantingInput,
} from '@/src/repositories/PlantingRepository';
import { SeasonRepository } from '@/src/repositories/SeasonRepository';

export type CreatePlantingWithPerennialInput = CreatePlantingInput & {
  /** When true, creates a new GardenPlant and links the planting. */
  isPerennial?: boolean;
  /** Reuse an existing garden plant instead of creating a new identity. */
  existingGardenPlantId?: string | null;
};

/**
 * Creates a season planting, optionally backed by a garden-level plant identity.
 */
export function createPlantingWithOptionalPerennial(
  db: SqlDatabase,
  input: CreatePlantingWithPerennialInput
): Planting {
  const plantings = new PlantingRepository(db);

  if (input.existingGardenPlantId) {
    return createLinkedToExistingGardenPlant(db, plantings, input);
  }

  if (input.isPerennial) {
    return createWithNewGardenPlant(db, plantings, input);
  }

  return plantings.create(input);
}

function createWithNewGardenPlant(
  db: SqlDatabase,
  plantings: PlantingRepository,
  input: CreatePlantingWithPerennialInput
): Planting {
  const season = new SeasonRepository(db).getById(input.seasonId);
  if (!season) {
    throw new StorageError('Season not found');
  }

  return db.withTransaction(() => {
    const gardenPlant = new GardenPlantRepository(db).create(
      toGardenPlantInput(season.gardenId, input)
    );

    return plantings.create({
      ...input,
      gardenPlantId: gardenPlant.id,
    });
  });
}

function createLinkedToExistingGardenPlant(
  db: SqlDatabase,
  plantings: PlantingRepository,
  input: CreatePlantingWithPerennialInput
): Planting {
  const season = new SeasonRepository(db).getById(input.seasonId);
  const gardenPlant = new GardenPlantRepository(db).getById(
    input.existingGardenPlantId!
  );

  if (!season || !gardenPlant) {
    throw new StorageError('Season or garden plant not found');
  }
  if (gardenPlant.gardenId !== season.gardenId) {
    throw new StorageError('Garden plant belongs to a different garden');
  }

  const existing = plantings.getBySeasonAndGardenPlant(
    input.seasonId,
    gardenPlant.id
  );
  if (existing) {
    throw new StorageError('This perennial is already in the season');
  }

  return plantings.create({
    ...input,
    gardenPlantId: gardenPlant.id,
    catalogItemId: input.catalogItemId ?? gardenPlant.catalogItemId,
    areaId: input.areaId !== undefined ? input.areaId : gardenPlant.areaId,
    quantity: input.quantity !== undefined ? input.quantity : gardenPlant.quantity,
    quantityUnit:
      input.quantityUnit !== undefined ? input.quantityUnit : gardenPlant.quantityUnit,
    notes: input.notes !== undefined ? input.notes : gardenPlant.notes,
  });
}

function toGardenPlantInput(
  gardenId: string,
  input: CreatePlantingWithPerennialInput
): CreateGardenPlantInput {
  return {
    gardenId,
    catalogItemId: input.catalogItemId,
    areaId: input.areaId,
    quantity: input.quantity,
    quantityUnit: input.quantityUnit,
    plantedDate: input.transplantDate ?? input.sowingDate ?? null,
    status: input.status ?? 'growing',
    notes: input.notes,
  };
}
