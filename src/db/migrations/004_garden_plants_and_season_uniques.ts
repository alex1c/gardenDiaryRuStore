/**
 * Migration 004 — garden-level plant identity and season cloning safeguards.
 *
 * - garden_plants: physical perennial identity spanning seasons
 * - plantings.garden_plant_id: links season planting to garden plant
 * - UNIQUE(season_id, garden_plant_id): idempotent perennial carry-over
 * - UNIQUE(garden_id, year): one season per garden per calendar year label
 */

import type { Migration, SqlDatabase } from '../types';

export const migration004GardenPlantsAndSeasonUniques: Migration = {
  version: 4,
  name: '004_garden_plants_and_season_uniques',

  up(db: SqlDatabase): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS garden_plants (
        id TEXT PRIMARY KEY NOT NULL,
        garden_id TEXT NOT NULL,
        area_id TEXT,
        catalog_item_id TEXT NOT NULL,
        name TEXT,
        quantity REAL CHECK (quantity IS NULL OR quantity > 0),
        quantity_unit TEXT,
        planted_date TEXT,
        status TEXT NOT NULL,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (garden_id) REFERENCES gardens(id) ON DELETE CASCADE,
        FOREIGN KEY (area_id) REFERENCES garden_areas(id) ON DELETE SET NULL,
        FOREIGN KEY (catalog_item_id) REFERENCES plant_catalog_items(id) ON DELETE RESTRICT
      );
    `);

    db.exec(`
      ALTER TABLE plantings
      ADD COLUMN garden_plant_id TEXT
      REFERENCES garden_plants(id) ON DELETE SET NULL;
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_garden_plants_garden_id
      ON garden_plants(garden_id);
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_plantings_garden_plant_id
      ON plantings(garden_plant_id);
    `);

    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_plantings_season_garden_plant
      ON plantings(season_id, garden_plant_id);
    `);

    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_seasons_garden_year
      ON seasons(garden_id, year);
    `);
  },
};
