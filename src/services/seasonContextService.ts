/**
 * Resolves active season from settings with deterministic fallback.
 */

import type { SqlDatabase } from '@/src/db/types';
import type { Season } from '@/src/domain/types';
import { SeasonRepository } from '@/src/repositories/SeasonRepository';
import { SettingsRepository } from '@/src/repositories/SettingsRepository';

/** Returns the user-selected active season or deterministic fallback. */
export function resolveActiveSeason(
  db: SqlDatabase,
  gardenId: string
): Season | null {
  const settings = new SettingsRepository(db).getSettings();
  const seasons = new SeasonRepository(db);

  if (settings.activeSeasonId) {
    const selected = seasons.getById(settings.activeSeasonId);
    if (selected && selected.gardenId === gardenId) {
      return selected;
    }
  }

  return seasons.getActiveForGarden(gardenId);
}

/** Persists active season selection for the garden. */
export function setActiveSeason(
  db: SqlDatabase,
  gardenId: string,
  seasonId: string
): Season {
  const seasons = new SeasonRepository(db);
  const season = seasons.getById(seasonId);
  if (!season || season.gardenId !== gardenId) {
    throw new Error('Season not found for this garden');
  }

  new SettingsRepository(db).patch({
    activeGardenId: gardenId,
    activeSeasonId: seasonId,
  });

  return season;
}
