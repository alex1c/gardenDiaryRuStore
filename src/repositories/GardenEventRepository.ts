/**
 * Garden event repository — historical actions that actually happened.
 */

import type { SqlDatabase } from '@/src/db/types';
import {
  WORK_TYPES,
  type DiaryFilterCategory,
  type WorkType,
} from '@/src/domain/codes';
import { StorageError } from '@/src/domain/errors';
import type { GardenEvent, LocalDate } from '@/src/domain/types';
import { createId } from '@/src/utils/id';
import { compareLocalDates, isValidLocalDateString } from '@/src/utils/localDate';
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

export type UpdateGardenEventInput = {
  type?: WorkType;
  title?: string;
  eventDate?: LocalDate;
  areaId?: string | null;
  plantingId?: string | null;
  notes?: string | null;
};

export type EventListOptions = {
  areaId?: string | null;
  plantingId?: string | null;
  category?: DiaryFilterCategory;
  fromDate?: LocalDate;
  toDate?: LocalDate;
  limit?: number;
  offset?: number;
};

const DEFAULT_LIST_LIMIT = 200;

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

  /**
   * Updates a manual diary event. Task-generated and harvest-linked events are read-only.
   */
  updateManual(id: string, input: UpdateGardenEventInput): GardenEvent {
    const existing = this.getById(id);
    if (!existing) {
      throw new StorageError('Event not found');
    }
    if (existing.taskId !== null) {
      throw new StorageError('Task-generated events cannot be edited');
    }
    if (this.isHarvestLinkedEvent(id)) {
      throw new StorageError('Harvest-linked events cannot be edited directly');
    }

    const next: GardenEvent = {
      ...existing,
      type: input.type ?? existing.type,
      title: input.title !== undefined ? input.title.trim() : existing.title,
      eventDate: input.eventDate ?? existing.eventDate,
      areaId: input.areaId !== undefined ? input.areaId : existing.areaId,
      plantingId:
        input.plantingId !== undefined ? input.plantingId : existing.plantingId,
      notes: input.notes !== undefined ? emptyToNull(input.notes) : existing.notes,
      updatedAt: nowIsoUtc(),
    };

    if (next.title.length === 0) {
      throw new StorageError('Event title is required');
    }

    assertWorkType(next.type);
    assertLocalDate(next.eventDate);
    this.assertSeasonConsistency(next.seasonId, next.areaId, next.plantingId);

    try {
      this.db.run(
        `UPDATE garden_events SET
           type = ?, title = ?, event_date = ?, area_id = ?, planting_id = ?,
           notes = ?, updated_at = ?
         WHERE id = ? AND task_id IS NULL`,
        [
          next.type,
          next.title,
          next.eventDate,
          next.areaId,
          next.plantingId,
          next.notes,
          next.updatedAt,
          id,
        ]
      );
      return next;
    } catch (err) {
      throw new StorageError('Failed to update garden event', err);
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

  /** Deletes only manual events; rejects task-generated and harvest-linked rows. */
  deleteManual(id: string): boolean {
    const existing = this.getById(id);
    if (!existing) {
      return false;
    }
    if (existing.taskId !== null) {
      throw new StorageError('Task-generated events cannot be deleted directly');
    }
    if (this.isHarvestLinkedEvent(id)) {
      throw new StorageError('Harvest-linked events cannot be deleted directly');
    }
    return this.delete(id);
  }

  /**
   * Syncs a harvest-linked diary event after harvest edit.
   * Bypasses manual/task guards — only called from harvestService.
   */
  syncHarvestLinked(
    id: string,
    input: Pick<UpdateGardenEventInput, 'title' | 'eventDate' | 'notes'>
  ): GardenEvent {
    const existing = this.getById(id);
    if (!existing) {
      throw new StorageError('Event not found');
    }

    const next: GardenEvent = {
      ...existing,
      title: input.title !== undefined ? input.title.trim() : existing.title,
      eventDate: input.eventDate ?? existing.eventDate,
      notes:
        input.notes !== undefined ? emptyToNull(input.notes) : existing.notes,
      updatedAt: nowIsoUtc(),
    };

    if (next.title.length === 0) {
      throw new StorageError('Event title is required');
    }
    assertLocalDate(next.eventDate);

    try {
      this.db.run(
        `UPDATE garden_events SET
           title = ?, event_date = ?, notes = ?, updated_at = ?
         WHERE id = ?`,
        [next.title, next.eventDate, next.notes, next.updatedAt, id]
      );
      return next;
    } catch (err) {
      throw new StorageError('Failed to sync harvest-linked event', err);
    }
  }

  listBySeason(seasonId: string, options: EventListOptions = {}): GardenEvent[] {
    return this.queryEvents(seasonId, options);
  }

  listForDate(seasonId: string, date: LocalDate): GardenEvent[] {
    assertLocalDate(date);
    return this.queryEvents(seasonId, { fromDate: date, toDate: date });
  }

  listByArea(areaId: string, limit = 5): GardenEvent[] {
    try {
      const rows = this.db.getAll<EventRow>(
        `SELECT * FROM garden_events
         WHERE area_id = ?
         ORDER BY event_date DESC, created_at DESC, id DESC
         LIMIT ?`,
        [areaId, limit]
      );
      return rows.map(mapEvent);
    } catch (err) {
      throw new StorageError('Failed to list events by area', err);
    }
  }

  listByPlanting(plantingId: string, limit?: number): GardenEvent[] {
    const capped = limit ?? DEFAULT_LIST_LIMIT;
    try {
      const rows = this.db.getAll<EventRow>(
        `SELECT * FROM garden_events
         WHERE planting_id = ?
         ORDER BY event_date DESC, created_at DESC, id DESC
         LIMIT ?`,
        [plantingId, capped]
      );
      return rows.map(mapEvent);
    } catch (err) {
      throw new StorageError('Failed to list events by planting', err);
    }
  }

  listByDateRange(
    seasonId: string,
    fromDate: LocalDate,
    toDate: LocalDate,
    options: Omit<EventListOptions, 'fromDate' | 'toDate'> = {}
  ): GardenEvent[] {
    assertLocalDate(fromDate);
    assertLocalDate(toDate);
    if (compareLocalDates(fromDate, toDate) > 0) {
      throw new StorageError('fromDate must be on or before toDate');
    }
    return this.queryEvents(seasonId, { ...options, fromDate, toDate });
  }

  private queryEvents(seasonId: string, options: EventListOptions): GardenEvent[] {
    const params: unknown[] = [seasonId];
    let sql = `SELECT * FROM garden_events WHERE season_id = ?`;

    if (options.areaId) {
      sql += ` AND area_id = ?`;
      params.push(options.areaId);
    }
    if (options.plantingId) {
      sql += ` AND planting_id = ?`;
      params.push(options.plantingId);
    }
    if (options.fromDate) {
      assertLocalDate(options.fromDate);
      sql += ` AND event_date >= ?`;
      params.push(options.fromDate);
    }
    if (options.toDate) {
      assertLocalDate(options.toDate);
      sql += ` AND event_date <= ?`;
      params.push(options.toDate);
    }
    if (options.category === 'observations') {
      sql += ` AND type = 'observation'`;
    } else if (options.category === 'works') {
      sql += ` AND type != 'observation'`;
    }

    sql += ` ORDER BY event_date DESC, created_at DESC, id DESC`;

    const limit = options.limit ?? DEFAULT_LIST_LIMIT;
    const offset = options.offset ?? 0;
    sql += ` LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    try {
      const rows = this.db.getAll<EventRow>(sql, params);
      return rows.map(mapEvent);
    } catch (err) {
      throw new StorageError('Failed to list garden events', err);
    }
  }

  private isHarvestLinkedEvent(eventId: string): boolean {
    const row = this.db.getFirst<{ id: string }>(
      `SELECT id FROM harvests WHERE event_id = ?`,
      [eventId]
    );
    return row !== null;
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
