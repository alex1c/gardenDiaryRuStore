/**
 * Migration 001 — initial garden diary schema (schema version 1).
 *
 * Delete semantics (summary; see docs/DATA_MODEL.md):
 * - Garden CASCADE → seasons, areas, plant_catalog_items
 * - Season CASCADE → plantings, tasks, events, harvests, expenses; photos.season_id CASCADE
 * - GardenArea SET NULL on seasonal FKs (preserve history)
 * - PlantCatalogItem RESTRICT when plantings reference it
 * - Planting CASCADE harvests; SET NULL on tasks/events/expenses/photos
 * - GardenEvent SET NULL on photos.event_id; GardenTask SET NULL on events.task_id
 */

import type { Migration, SqlDatabase } from '../types';

export const migration001Initial: Migration = {
  version: 1,
  name: '001_initial',

  up(db: SqlDatabase): void {
    // --- Ownership root: garden plot ---
    db.exec(`
      CREATE TABLE IF NOT EXISTS gardens (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        location_name TEXT,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    // --- Season is a first-class entity (not just a year integer) ---
    db.exec(`
      CREATE TABLE IF NOT EXISTS seasons (
        id TEXT PRIMARY KEY NOT NULL,
        garden_id TEXT NOT NULL,
        year INTEGER NOT NULL,
        title TEXT NOT NULL,
        start_date TEXT,
        end_date TEXT,
        archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (garden_id) REFERENCES gardens(id) ON DELETE CASCADE
      );
    `);

    // --- Physical zones; deleting a zone does NOT wipe seasonal history ---
    db.exec(`
      CREATE TABLE IF NOT EXISTS garden_areas (
        id TEXT PRIMARY KEY NOT NULL,
        garden_id TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        length REAL CHECK (length IS NULL OR length > 0),
        width REAL CHECK (width IS NULL OR width > 0),
        notes TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (garden_id) REFERENCES gardens(id) ON DELETE CASCADE
      );
    `);

    // --- Catalog culture/variety (not a planting) ---
    db.exec(`
      CREATE TABLE IF NOT EXISTS plant_catalog_items (
        id TEXT PRIMARY KEY NOT NULL,
        garden_id TEXT NOT NULL,
        species_name TEXT NOT NULL,
        variety_name TEXT,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (garden_id) REFERENCES gardens(id) ON DELETE CASCADE
      );
    `);

    // --- Concrete planting in a season ---
    db.exec(`
      CREATE TABLE IF NOT EXISTS plantings (
        id TEXT PRIMARY KEY NOT NULL,
        season_id TEXT NOT NULL,
        area_id TEXT,
        catalog_item_id TEXT NOT NULL,
        quantity REAL CHECK (quantity IS NULL OR quantity > 0),
        quantity_unit TEXT,
        sowing_date TEXT,
        transplant_date TEXT,
        harvest_start_date TEXT,
        status TEXT NOT NULL,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE,
        FOREIGN KEY (area_id) REFERENCES garden_areas(id) ON DELETE SET NULL,
        FOREIGN KEY (catalog_item_id) REFERENCES plant_catalog_items(id) ON DELETE NO ACTION
      );
    `);

    // --- Planned work (Task ≠ Event) ---
    db.exec(`
      CREATE TABLE IF NOT EXISTS garden_tasks (
        id TEXT PRIMARY KEY NOT NULL,
        season_id TEXT NOT NULL,
        area_id TEXT,
        planting_id TEXT,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        due_date TEXT NOT NULL,
        completed_at TEXT,
        repeat_type TEXT NOT NULL DEFAULT 'none',
        repeat_interval INTEGER,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE,
        FOREIGN KEY (area_id) REFERENCES garden_areas(id) ON DELETE SET NULL,
        FOREIGN KEY (planting_id) REFERENCES plantings(id) ON DELETE SET NULL
      );
    `);

    // --- Historical actions that actually happened ---
    db.exec(`
      CREATE TABLE IF NOT EXISTS garden_events (
        id TEXT PRIMARY KEY NOT NULL,
        season_id TEXT NOT NULL,
        area_id TEXT,
        planting_id TEXT,
        task_id TEXT,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        event_date TEXT NOT NULL,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE,
        FOREIGN KEY (area_id) REFERENCES garden_areas(id) ON DELETE SET NULL,
        FOREIGN KEY (planting_id) REFERENCES plantings(id) ON DELETE SET NULL,
        FOREIGN KEY (task_id) REFERENCES garden_tasks(id) ON DELETE SET NULL
      );
    `);

    // --- Harvest records (quantity is REAL; unit is TEXT) ---
    db.exec(`
      CREATE TABLE IF NOT EXISTS harvests (
        id TEXT PRIMARY KEY NOT NULL,
        season_id TEXT NOT NULL,
        planting_id TEXT NOT NULL,
        date TEXT NOT NULL,
        quantity REAL NOT NULL CHECK (quantity > 0),
        unit TEXT NOT NULL,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE,
        FOREIGN KEY (planting_id) REFERENCES plantings(id) ON DELETE CASCADE
      );
    `);

    // --- Expenses: amount stored as INTEGER kopecks ---
    db.exec(`
      CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY NOT NULL,
        season_id TEXT NOT NULL,
        area_id TEXT,
        planting_id TEXT,
        date TEXT NOT NULL,
        category TEXT NOT NULL,
        amount_kopecks INTEGER NOT NULL CHECK (
          typeof(amount_kopecks) = 'integer' AND amount_kopecks >= 0
        ),
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE,
        FOREIGN KEY (area_id) REFERENCES garden_areas(id) ON DELETE SET NULL,
        FOREIGN KEY (planting_id) REFERENCES plantings(id) ON DELETE SET NULL
      );
    `);

    // --- Photo metadata only (no BLOB). File cleanup is a future service concern. ---
    db.exec(`
      CREATE TABLE IF NOT EXISTS garden_photos (
        id TEXT PRIMARY KEY NOT NULL,
        garden_id TEXT NOT NULL,
        season_id TEXT,
        area_id TEXT,
        planting_id TEXT,
        event_id TEXT,
        uri TEXT NOT NULL,
        taken_at TEXT,
        caption TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (garden_id) REFERENCES gardens(id) ON DELETE CASCADE,
        FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE,
        FOREIGN KEY (area_id) REFERENCES garden_areas(id) ON DELETE SET NULL,
        FOREIGN KEY (planting_id) REFERENCES plantings(id) ON DELETE SET NULL,
        FOREIGN KEY (event_id) REFERENCES garden_events(id) ON DELETE SET NULL
      );
    `);

    // --- Key-value settings (extensible without schema churn) ---
    db.exec(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    // --- Indexes for common query paths ---
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_seasons_garden_id ON seasons(garden_id);
    `);
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_garden_areas_garden_id ON garden_areas(garden_id);
    `);
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_plant_catalog_garden_id ON plant_catalog_items(garden_id);
    `);
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_plantings_season_id ON plantings(season_id);
    `);
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_plantings_area_id ON plantings(area_id);
    `);
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_plantings_catalog_item_id ON plantings(catalog_item_id);
    `);
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_garden_tasks_season_due ON garden_tasks(season_id, due_date);
    `);
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_garden_events_season_date ON garden_events(season_id, event_date);
    `);
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_harvests_planting_id ON harvests(planting_id);
    `);
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_expenses_season_date ON expenses(season_id, date);
    `);
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_garden_photos_garden_id ON garden_photos(garden_id);
    `);
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_garden_photos_season_id ON garden_photos(season_id);
    `);
  },
};
