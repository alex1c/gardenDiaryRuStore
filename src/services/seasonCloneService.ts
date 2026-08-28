/**
 * Atomic season creation with optional carry-over from a previous season.
 */

import type { SqlDatabase } from '@/src/db/types';
import { ACTIVE_PLANTING_STATUSES, type PlantingStatus } from '@/src/domain/codes';
import { StorageError } from '@/src/domain/errors';
import type { Season } from '@/src/domain/types';
import { PlantingRepository } from '@/src/repositories/PlantingRepository';
import { SeasonRepository } from '@/src/repositories/SeasonRepository';
import { setActiveSeason } from '@/src/services/seasonContextService';

export type CreateSeasonOptions = {
  gardenId: string;
  year: number;
  title: string;
  sourceSeasonId?: string | null;
  setActive?: boolean;
  /** Carry perennials linked via garden_plant_id (idempotent). */
  copyPerennials?: boolean;
  /** Copy active annual plantings as new planned rows. */
  copyAnnualPlantings?: boolean;
};

export type CreateSeasonResult = {
  season: Season;
  perennialsCopied: number;
  annualsCopied: number;
};

/** Creates a season, optionally cloning plantings from a source season. */
export function createSeasonWithOptions(
  db: SqlDatabase,
  options: CreateSeasonOptions
): CreateSeasonResult {
  const seasons = new SeasonRepository(db);
  const plantings = new PlantingRepository(db);

  if (seasons.getByGardenAndYear(options.gardenId, options.year)) {
    throw new StorageError(`Season for year ${options.year} already exists`);
  }

  return db.withTransaction(() => {
    const season = seasons.create({
      gardenId: options.gardenId,
      year: options.year,
      title: options.title,
    });

    let perennialsCopied = 0;
    let annualsCopied = 0;

    if (options.sourceSeasonId) {
      const source = seasons.getById(options.sourceSeasonId);
      if (!source || source.gardenId !== options.gardenId) {
        throw new StorageError('Source season belongs to a different garden');
      }

      const sourcePlantings = plantings.listBySeason(options.sourceSeasonId);

      if (options.copyPerennials) {
        perennialsCopied = transferPerennialsToSeason(
          plantings,
          sourcePlantings,
          season.id
        );
      }

      if (options.copyAnnualPlantings) {
        annualsCopied = copyAnnualPlantingsToSeason(
          plantings,
          sourcePlantings,
          season.id
        );
      }
    }

    if (options.setActive !== false) {
      setActiveSeason(db, options.gardenId, season.id);
    }

    return { season, perennialsCopied, annualsCopied };
  });
}

/**
 * Idempotent perennial transfer — skips garden plants already present in target season.
 */
export function transferPerennialsToSeason(
  plantingRepo: PlantingRepository,
  sourcePlantings: ReturnType<PlantingRepository['listBySeason']>,
  targetSeasonId: string
): number {
  const seen = new Set<string>();
  let copied = 0;

  for (const source of sourcePlantings) {
    if (!source.gardenPlantId || seen.has(source.gardenPlantId)) {
      continue;
    }
    seen.add(source.gardenPlantId);

    if (plantingRepo.getBySeasonAndGardenPlant(targetSeasonId, source.gardenPlantId)) {
      continue;
    }

    plantingRepo.create({
      seasonId: targetSeasonId,
      catalogItemId: source.catalogItemId,
      areaId: source.areaId,
      gardenPlantId: source.gardenPlantId,
      quantity: source.quantity,
      quantityUnit: source.quantityUnit,
      status: pickCarryOverStatus(source.status),
      notes: source.notes,
    });
    copied += 1;
  }

  return copied;
}

function copyAnnualPlantingsToSeason(
  plantingRepo: PlantingRepository,
  sourcePlantings: ReturnType<PlantingRepository['listBySeason']>,
  targetSeasonId: string
): number {
  let copied = 0;

  for (const source of sourcePlantings) {
    if (source.gardenPlantId) {
      continue;
    }
    if (!(ACTIVE_PLANTING_STATUSES as readonly string[]).includes(source.status)) {
      continue;
    }

    plantingRepo.create({
      seasonId: targetSeasonId,
      catalogItemId: source.catalogItemId,
      areaId: source.areaId,
      quantity: source.quantity,
      quantityUnit: source.quantityUnit,
      status: 'planned',
      notes: source.notes,
    });
    copied += 1;
  }

  return copied;
}

function pickCarryOverStatus(status: PlantingStatus): PlantingStatus {
  if ((ACTIVE_PLANTING_STATUSES as readonly string[]).includes(status)) {
    return status === 'planned' || status === 'sown' ? 'growing' : status;
  }
  return 'growing';
}
