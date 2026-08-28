/**
 * Harvest repository — CRUD and list queries for harvest records.
 */

import type { SqlDatabase } from '@/src/db/types';
import {
  HARVEST_UNITS,
  type HarvestUnit,
} from '@/src/domain/codes';
import { StorageError } from '@/src/domain/errors';
import type { Harvest, LocalDate } from '@/src/domain/types';
import { createId } from '@/src/utils/id';
import { compareLocalDates, isValidLocalDateString } from '@/src/utils/localDate';
import { nowIsoUtc } from '@/src/utils/timestamps';

type HarvestRow = {
  id: string;
  season_id: string;
  planting_id: string;
  event_id: string | null;
  date: string;
  quantity: number;
  unit: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateHarvestInput = {
  seasonId: string;
  plantingId: string;
  date: LocalDate;
  quantity: number;
  unit: HarvestUnit;
  notes?: string | null;
  eventId?: string | null;
};

export type UpdateHarvestInput = {
  date?: LocalDate;
  quantity?: number;
  unit?: HarvestUnit;
  notes?: string | null;
  eventId?: string | null;
};

export type HarvestListOptions = {
  fromDate?: LocalDate;
  toDate?: LocalDate;
  limit?: number;
  offset?: number;
};

const DEFAULT_LIST_LIMIT = 200;

export class HarvestRepository {
  constructor(private readonly db: SqlDatabase) {}

  create(input: CreateHarvestInput): Harvest {
    assertHarvestUnit(input.unit);
    assertLocalDate(input.date);
    assertPositiveFinite(input.quantity, 'Harvest quantity');
    this.assertPlantingInSeason(input.seasonId, input.plantingId);

    const now = nowIsoUtc();
    const harvest: Harvest = {
      id: createId(),
      seasonId: input.seasonId,
      plantingId: input.plantingId,
      eventId: input.eventId ?? null,
      date: input.date,
      quantity: input.quantity,
      unit: input.unit,
      notes: emptyToNull(input.notes),
      createdAt: now,
      updatedAt: now,
    };

    try {
      this.db.run(
        `INSERT INTO harvests
         (id, season_id, planting_id, event_id, date, quantity, unit,
          notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          harvest.id,
          harvest.seasonId,
          harvest.plantingId,
          harvest.eventId,
          harvest.date,
          harvest.quantity,
          harvest.unit,
          harvest.notes,
          harvest.createdAt,
          harvest.updatedAt,
        ]
      );
      return harvest;
    } catch (err) {
      throw new StorageError('Failed to create harvest', err);
    }
  }

  getById(id: string): Harvest | null {
    try {
      const row = this.db.getFirst<HarvestRow>(
        `SELECT * FROM harvests WHERE id = ?`,
        [id]
      );
      return row ? mapHarvest(row) : null;
    } catch (err) {
      throw new StorageError('Failed to read harvest', err);
    }
  }

  getByEventId(eventId: string): Harvest | null {
    try {
      const row = this.db.getFirst<HarvestRow>(
        `SELECT * FROM harvests WHERE event_id = ?`,
        [eventId]
      );
      return row ? mapHarvest(row) : null;
    } catch (err) {
      throw new StorageError('Failed to read harvest by event', err);
    }
  }

  update(id: string, input: UpdateHarvestInput): Harvest {
    const existing = this.getById(id);
    if (!existing) {
      throw new StorageError('Harvest not found');
    }

    const next: Harvest = {
      ...existing,
      date: input.date ?? existing.date,
      quantity: input.quantity ?? existing.quantity,
      unit: input.unit ?? existing.unit,
      notes: input.notes !== undefined ? emptyToNull(input.notes) : existing.notes,
      eventId: input.eventId !== undefined ? input.eventId : existing.eventId,
      updatedAt: nowIsoUtc(),
    };

    assertHarvestUnit(next.unit);
    assertLocalDate(next.date);
    assertPositiveFinite(next.quantity, 'Harvest quantity');

    try {
      this.db.run(
        `UPDATE harvests SET
           date = ?, quantity = ?, unit = ?, notes = ?,
           event_id = ?, updated_at = ?
         WHERE id = ?`,
        [
          next.date,
          next.quantity,
          next.unit,
          next.notes,
          next.eventId,
          next.updatedAt,
          id,
        ]
      );
      return next;
    } catch (err) {
      throw new StorageError('Failed to update harvest', err);
    }
  }

  delete(id: string): boolean {
    try {
      const result = this.db.run(`DELETE FROM harvests WHERE id = ?`, [id]);
      return result.changes > 0;
    } catch (err) {
      throw new StorageError('Failed to delete harvest', err);
    }
  }

  listBySeason(
    seasonId: string,
    options: HarvestListOptions = {}
  ): Harvest[] {
    return this.queryHarvests('season_id = ?', [seasonId], options);
  }

  listByPlanting(
    plantingId: string,
    limit?: number
  ): Harvest[] {
    return this.queryHarvests(
      'planting_id = ?',
      [plantingId],
      { limit: limit ?? DEFAULT_LIST_LIMIT }
    );
  }

  listByDateRange(
    seasonId: string,
    fromDate: LocalDate,
    toDate: LocalDate,
    options: Omit<HarvestListOptions, 'fromDate' | 'toDate'> = {}
  ): Harvest[] {
    assertLocalDate(fromDate);
    assertLocalDate(toDate);
    if (compareLocalDates(fromDate, toDate) > 0) {
      throw new StorageError('fromDate must be on or before toDate');
    }
    return this.queryHarvests(
      'season_id = ? AND date >= ? AND date <= ?',
      [seasonId, fromDate, toDate],
      options
    );
  }

  private queryHarvests(
    whereClause: string,
    params: unknown[],
    options: HarvestListOptions
  ): Harvest[] {
    let sql = `SELECT * FROM harvests WHERE ${whereClause}`;
    const queryParams = [...params];

    if (options.fromDate) {
      assertLocalDate(options.fromDate);
      sql += ` AND date >= ?`;
      queryParams.push(options.fromDate);
    }
    if (options.toDate) {
      assertLocalDate(options.toDate);
      sql += ` AND date <= ?`;
      queryParams.push(options.toDate);
    }

    sql += ` ORDER BY date DESC, created_at DESC, id DESC`;

    const limit = options.limit ?? DEFAULT_LIST_LIMIT;
    const offset = options.offset ?? 0;
    sql += ` LIMIT ? OFFSET ?`;
    queryParams.push(limit, offset);

    try {
      const rows = this.db.getAll<HarvestRow>(sql, queryParams);
      return rows.map(mapHarvest);
    } catch (err) {
      throw new StorageError('Failed to list harvests', err);
    }
  }

  private assertPlantingInSeason(
    seasonId: string,
    plantingId: string
  ): void {
    const row = this.db.getFirst<{
      planting_season_id: string;
      season_garden_id: string;
      catalog_garden_id: string;
    }>(
      `SELECT p.season_id AS planting_season_id,
              s.garden_id AS season_garden_id,
              c.garden_id AS catalog_garden_id
       FROM plantings p
       JOIN seasons s ON s.id = ?
       JOIN plant_catalog_items c ON c.id = p.catalog_item_id
       WHERE p.id = ?`,
      [seasonId, plantingId]
    );

    if (!row) {
      throw new StorageError('Harvest references a missing planting or season');
    }
    if (row.planting_season_id !== seasonId) {
      throw new StorageError(
        'Harvest references planting from a different season'
      );
    }
    if (row.season_garden_id !== row.catalog_garden_id) {
      throw new StorageError(
        'Harvest references planting from a different garden'
      );
    }
  }
}

function mapHarvest(row: HarvestRow): Harvest {
  return {
    id: row.id,
    seasonId: row.season_id,
    plantingId: row.planting_id,
    eventId: row.event_id,
    date: row.date,
    quantity: row.quantity,
    unit: row.unit as HarvestUnit,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function assertHarvestUnit(unit: string): asserts unit is HarvestUnit {
  if (!(HARVEST_UNITS as readonly string[]).includes(unit)) {
    throw new StorageError(`Invalid harvest unit: ${unit}`);
  }
}

function assertLocalDate(value: string): void {
  if (!isValidLocalDateString(value)) {
    throw new StorageError(`Invalid local date: ${value}`);
  }
}

function assertPositiveFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new StorageError(`${label} must be a positive number`);
  }
}

function emptyToNull(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}
