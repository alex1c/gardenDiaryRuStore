# Data model

Schema version: **1**  
Database file: `garden_diary.db`  
IDs: application-generated UUID strings  
Migrations: numbered forward-only via `PRAGMA user_version` (transactional per migration)

## Ownership tree

```text
Garden
├── Season
│   ├── Planting → Harvest (CASCADE with planting)
│   ├── GardenTask
│   ├── GardenEvent
│   ├── Expense
│   └── GardenPhoto (garden-owned; optional season link)
├── GardenArea
└── PlantCatalogItem
```

UI v1 may show one garden; the schema supports many.

## Entities

| Entity | Table | Notes |
|--------|-------|-------|
| Garden | `gardens` | Plot root |
| Season | `seasons` | First-class; `year` is a label, not a hard date bound |
| GardenArea | `garden_areas` | Zone types: bed, greenhouse, … |
| PlantCatalogItem | `plant_catalog_items` | Culture/variety reference |
| Planting | `plantings` | Concrete planting in a season |
| GardenTask | `garden_tasks` | Planned work |
| GardenEvent | `garden_events` | What actually happened (≠ Task) |
| Harvest | `harvests` | Quantity REAL + unit |
| Expense | `expenses` | `amount_kopecks` INTEGER |
| GardenPhoto | `garden_photos` | URI metadata only — no BLOB |
| AppSettings | `app_settings` | Key-value store |

## Foreign keys (must be ON)

`PRAGMA foreign_keys = ON` is set on every connection in `createDatabaseFromClient`.

### Delete semantics

| Parent deleted | Child behavior | Rationale |
|----------------|----------------|-----------|
| Garden | CASCADE seasons, areas, catalog, photos | Plot ownership; no orphans |
| Season | CASCADE plantings, tasks, events, harvests, expenses; CASCADE photos by `season_id` | Season-scoped history leaves with the season |
| GardenArea | SET NULL on plantings / tasks / events / expenses / photos | Keep seasonal history without inventing a fake zone |
| PlantCatalogItem | NO ACTION if plantings exist | Protect history while allowing whole-Garden cascades to finish atomically |
| Planting | CASCADE harvests; SET NULL on tasks / events / expenses / photos | Harvests are meaningless without planting; diary links stay |
| GardenTask | SET NULL on `events.task_id` | Event history remains |
| GardenEvent | SET NULL on `photos.event_id` | Photo row remains; file GC is a future service |

**Not** “CASCADE everywhere”. Prefer preserving history when a spatial link (area) is removed.

### Photo URI strategy

- Store only `uri` (+ optional caption / takenAt).
- Never store image binary in SQLite.
- On DB row delete: future photo service should collect orphaned files.
- When `season_id` cascades away, photo rows go with the season (controlled, not silent orphans).

## Timestamps vs local dates

| Kind | Storage | Examples |
|------|---------|----------|
| Audit / completion instants | ISO-8601 UTC (`…Z`) | `createdAt`, `updatedAt`, `completedAt`, `takenAt` |
| User calendar dates | `YYYY-MM-DD` local | `dueDate`, `sowingDate`, `eventDate`, `harvest.date`, season `startDate`/`endDate` |

Rules:

1. Do **not** derive a calendar day by `iso.substring(0, 10)`.
2. Do **not** use `new Date('2026-05-10')` as a local calendar source (UTC midnight can shift the day).
3. Use `src/utils/localDate.ts` (`toLocalDateString`, `parseLocalDate`).
4. Season `year` does **not** constrain event dates to that calendar year (e.g. season 2027 may start in Dec 2026).

## Amounts

### Harvest quantity

- Stored as `REAL` with explicit `unit` (`kg` \| `g` \| `pcs`).
- Canonical DB value is numeric — never `"3,4"` as a string.
- UI decimal drafts use string state + `parseFlexibleNumber` / `finalizeNumber`.

### Expense money

- Stored as **integer kopecks** (`amount_kopecks`).
- `12345` = `123.45` RUB.
- Helpers: `src/utils/money.ts` (`rublesToKopecks`, `kopecksToRubles`).
- Avoid float accumulation for money totals (sum integers, convert for display).

## App settings

Key-value table (`key`, `value`, `updated_at`) mapped to typed `AppSettings`:

- `onboardingCompleted`
- `notificationsEnabled`
- `themePreference`
- `activeGardenId` / `activeSeasonId`
- `settingsVersion`

New keys can be added without schema migrations.

## Migration strategy

1. Add `src/db/migrations/00N_*.ts` with `version: N`.
2. Register in `migrations/index.ts`.
3. Bump `CURRENT_SCHEMA_VERSION`.
4. Runner applies pending versions inside transactions; re-open is idempotent.
5. No destructive “wipe and recreate” on upgrade.
6. Migration versions must be contiguous; startup rejects gaps and databases newer than the app.

## Derived data (do not persist)

Do **not** store aggregates such as total harvest, total expenses, plant count per area, or task counts. Compute at read time.

## Future season / perennial compatibility

- Seasons are entities; plantings belong to a season.
- Catalog items belong to a garden (not a season) so varieties can span years.
- Area SET NULL policy keeps historical plantings readable after layout changes.
- Later perennial support can link multi-year plantings without rewriting v1 FK rules.
- A future garden-level perennial instance can be added in a forward migration and referenced by
  season-level plantings, preserving one physical plant identity across years without changing
  existing planting or history keys.

## Cross-garden integrity

Repositories must reject links whose referenced entities belong to different gardens. Phase 1
enforces this for `Planting` create/update (season, catalog item, and optional area). Repositories
added for tasks/events/harvests/expenses/photos must apply the same ownership validation before
writing their optional links.
