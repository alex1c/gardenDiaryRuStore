/**
 * Ordered list of schema migrations and the current target schema version.
 */

import { migration001Initial } from './001_initial';
import { migration002TaskProvenance } from './002_task_provenance';
import { migration003HarvestEventLink } from './003_harvest_event_link';
import { migration004GardenPlantsAndSeasonUniques } from './004_garden_plants_and_season_uniques';
import type { Migration } from '../types';

/** All forward migrations in ascending version order. */
export const MIGRATIONS: readonly Migration[] = [
  migration001Initial,
  migration002TaskProvenance,
  migration003HarvestEventLink,
  migration004GardenPlantsAndSeasonUniques,
];

/** Highest schema version this app build knows how to apply. */
export const CURRENT_SCHEMA_VERSION = 4;
