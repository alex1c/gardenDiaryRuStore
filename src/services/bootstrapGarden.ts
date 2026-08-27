/**
 * First-run bootstrap: create a garden and its default season atomically.
 * Does NOT auto-create a new season on calendar year change — user-driven later.
 */

import type { SqlDatabase } from '@/src/db/types';
import type { Garden, Season } from '@/src/domain/types';
import { GardenRepository } from '@/src/repositories/GardenRepository';
import { SeasonRepository } from '@/src/repositories/SeasonRepository';
import { SettingsRepository } from '@/src/repositories/SettingsRepository';

export type BootstrapGardenResult = {
  garden: Garden;
  season: Season;
};

/**
 * Creates a garden + default season for the given calendar year (local).
 * Updates settings.activeGardenId / activeSeasonId / onboardingCompleted.
 */
export function bootstrapGardenWithSeason(
  db: SqlDatabase,
  options: {
    gardenName: string;
    /** Local calendar year used for season.year and default title. */
    year?: number;
  }
): BootstrapGardenResult {
  const year = options.year ?? new Date().getFullYear();
  const gardens = new GardenRepository(db);
  const seasons = new SeasonRepository(db);
  const settings = new SettingsRepository(db);

  // Atomic bootstrap: garden + season + active settings pointers together.
  return db.withTransaction(() => {
    const garden = gardens.create({ name: options.gardenName });
    const season = seasons.create({
      gardenId: garden.id,
      year,
      title: `Сезон ${year}`,
    });

    settings.patch({
      activeGardenId: garden.id,
      activeSeasonId: season.id,
      onboardingCompleted: true,
    });

    return { garden, season };
  });
}
