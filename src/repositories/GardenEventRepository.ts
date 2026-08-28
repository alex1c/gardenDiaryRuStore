/**
 * Garden event repository — historical actions that actually happened.
 */

import type { SqlDatabase } from '@/src/db/types';
import { WORK_TYPES, type WorkType } from '@/src/domain/codes';
import { StorageError } from '@/src/domain/errors';
import type { GardenEvent, LocalDate } from '@/src/domain/types';
import { createId } from '@/src/utils/id';
import { isValidLocalDateString } from '@/src/utils/localDate';
import { nowIsoUtc } from '@/src/utils/timestamps';

type EventRow = {
  id: string;
  season_id: string;
  area_id: string | null;
  planting_id: string | null;
  task_id: string | null;
  type: string;
  title: string;
  event_date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateGardenEventInput = {
  seasonId: string;
  type: WorkType;
  title: string;
  eventDate: LocalDate;
  areaId?: string | null;
  plantingId?: string | null;
  taskId?: string | null;
  notes?: string | null;
};

export class GardenEventRepository {
  constructor(private readonly db: SqlDatabase) {}

  create(input: CreateGardenEventInput): GardenEvent {
    assertWorkType(input.type);
    assertLocalDate(input.eventDate);
    this.assertSeasonConsistency(
      input.seasonId,
      input.areaId ?? null,
      input.plantingId ?? null
    );

    const now = nowIsoUtc();
    const event: GardenEvent = {
      id: createId(),
      seasonId: input.seasonId,
      areaId: input.areaId ?? null,
      plantingId: input.plantingId ?? null,
      taskId: input.taskId ?? null,
      type: input.type,
      title: input.title.trim(),
      eventDate: input.eventDate,
      notes: emptyToNull(input.notes),
      createdAt: now,
      updatedAt: now,
    };

    if (event.title.length === 0) {
      throw new StorageError('Event title is required');
    }

    try {
      this.db.run(
        `INSERT INTO garden_events
         (id, season_id, area_id, planting_id, task_id, type, title,
          event_date, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          event.id,
          event.seasonId,
          event.areaId,
          event.plantingId,
          event.taskId,
          event.type,
          event.title,
          event.eventDate,
          event.notes,
          event.createdAt,
          event.updatedAt,
        ]
      );
      return event;
    } catch (err) {
      throw new StorageError('Failed to create garden event', err);
    }
  }

  getById(id: string): GardenEvent | null {
    try {
      const row = this.db.getFirst<EventRow>(
        `SELECT * FROM garden_events WHERE id = ?`,
        [id]
      );
      return row ? mapEvent(row) : null;
    } catch (err) {
      throw new StorageError('Failed to read garden event', err);
    }
  }

  delete(id: string): boolean {
    try {
      const result = this.db.run(`DELETE FROM garden_events WHERE id = ?`, [id]);
      return result.changes > 0;
    } catch (err) {
      throw new StorageError('Failed to delete garden event', err);
    }
  }

  /** Lists events for a season, newest calendar day first. */
  listBySeason(seasonId: string): GardenEvent[] {
    try {
      const rows = this.db.getAll<EventRow>(
        `SELECT * FROM garden_events
         WHERE season_id = ?
         ORDER BY event_date DESC, created_at DESC, id DESC`,
        [seasonId]
      );
      return rows.map(mapEvent);
    } catch (err) {
      throw new StorageError('Failed to list garden events', err);
    }
  }

  listForDate(seasonId: string, date: LocalDate): GardenEvent[] {
    assertLocalDate(date);
    try {
      const rows = this.db.getAll<EventRow>(
        `SELECT * FROM garden_events
         WHERE season_id = ? AND event_date = ?
         ORDER BY created_at DESC, id DESC`,
        [seasonId, date]
      );
      return rows.map(mapEvent);
    } catch (err) {
      throw new StorageError('Failed to list garden events for date', err);
    }
  }

  private assertSeasonConsistency(
    seasonId: string,
    areaId: string | null,
    plantingId: string | null
  ): void {
    const row = this.db.getFirst<{
      season_garden_id: string;
      area_garden_id: string | null;
      planting_season_id: string | null;
    }>(
      `SELECT s.garden_id AS season_garden_id,
              a.garden_id AS area_garden_id,
              p.season_id AS planting_season_id
       FROM seasons s
       LEFT JOIN garden_areas a ON a.id = ?
       LEFT JOIN plantings p ON p.id = ?
       WHERE s.id = ?`,
      [areaId, plantingId, seasonId]
    );

    if (!row) {
      throw new StorageError('Event references a missing season');
    }
    if (areaId !== null && row.area_garden_id === null) {
      throw new StorageError('Event references a missing garden area');
    }
    if (plantingId !== null && row.planting_season_id === null) {
      throw new StorageError('Event references a missing planting');
    }
    if (
      areaId !== null &&
      row.area_garden_id !== null &&
      row.season_garden_id !== row.area_garden_id
    ) {
      throw new StorageError('Event references area from a different garden');
    }
    if (
      plantingId !== null &&
      row.planting_season_id !== null &&
      row.planting_season_id !== seasonId
    ) {
      throw new StorageError('Event references planting from a different season');
    }
  }
}

function mapEvent(row: EventRow): GardenEvent {
  return {
    id: row.id,
    seasonId: row.season_id,
    areaId: row.area_id,
    plantingId: row.planting_id,
    taskId: row.task_id,
    type: row.type as WorkType,
    title: row.title,
    eventDate: row.event_date,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function assertWorkType(type: string): asserts type is WorkType {
  if (!(WORK_TYPES as readonly string[]).includes(type)) {
    throw new StorageError(`Invalid work type: ${type}`);
  }
}

function assertLocalDate(value: string): void {
  if (!isValidLocalDateString(value)) {
    throw new StorageError(`Invalid local date: ${value}`);
  }
}

function emptyToNull(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}
