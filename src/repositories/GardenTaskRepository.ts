/**
 * Garden task repository — planned work with recurrence and provenance links.
 */

import type { SqlDatabase } from '@/src/db/types';
import {
  REPEAT_TYPES,
  WORK_TYPES,
  type RepeatType,
  type WorkType,
} from '@/src/domain/codes';
import { StorageError } from '@/src/domain/errors';
import type { GardenTask, LocalDate, UtcInstant } from '@/src/domain/types';
import { createId } from '@/src/utils/id';
import { isValidLocalDateString } from '@/src/utils/localDate';
import { nowIsoUtc } from '@/src/utils/timestamps';

type TaskRow = {
  id: string;
  season_id: string;
  area_id: string | null;
  planting_id: string | null;
  type: string;
  title: string;
  due_date: string;
  completed_at: string | null;
  repeat_type: string;
  repeat_interval: number | null;
  notes: string | null;
  completion_event_id: string | null;
  spawned_task_id: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateGardenTaskInput = {
  seasonId: string;
  type: WorkType;
  title: string;
  dueDate: LocalDate;
  areaId?: string | null;
  plantingId?: string | null;
  repeatType?: RepeatType;
  repeatInterval?: number | null;
  notes?: string | null;
};

export type UpdateGardenTaskInput = {
  type?: WorkType;
  title?: string;
  dueDate?: LocalDate;
  areaId?: string | null;
  plantingId?: string | null;
  repeatType?: RepeatType;
  repeatInterval?: number | null;
  notes?: string | null;
};

/** Internal shape for spawning the next recurring occurrence. */
export type SpawnNextTaskInput = {
  seasonId: string;
  areaId: string | null;
  plantingId: string | null;
  type: WorkType;
  title: string;
  dueDate: LocalDate;
  repeatType: RepeatType;
  repeatInterval: number | null;
  notes: string | null;
};

export class GardenTaskRepository {
  constructor(private readonly db: SqlDatabase) {}

  create(input: CreateGardenTaskInput): GardenTask {
    const repeatType = input.repeatType ?? 'none';
    assertWorkType(input.type);
    assertRepeatType(repeatType);
    assertLocalDate(input.dueDate);
    assertRepeatInterval(repeatType, input.repeatInterval ?? null);

    const title = input.title.trim();
    if (title.length === 0) {
      throw new StorageError('Task title is required');
    }

    this.assertSameGarden(
      input.seasonId,
      input.areaId ?? null,
      input.plantingId ?? null
    );

    const now = nowIsoUtc();
    const task: GardenTask = {
      id: createId(),
      seasonId: input.seasonId,
      areaId: input.areaId ?? null,
      plantingId: input.plantingId ?? null,
      type: input.type,
      title,
      dueDate: input.dueDate,
      completedAt: null,
      repeatType,
      repeatInterval: normalizeRepeatInterval(repeatType, input.repeatInterval ?? null),
      notes: emptyToNull(input.notes),
      completionEventId: null,
      spawnedTaskId: null,
      createdAt: now,
      updatedAt: now,
    };

    try {
      this.insertTask(task);
      return task;
    } catch (err) {
      throw new StorageError('Failed to create garden task', err);
    }
  }

  /** Creates the next recurring occurrence (called inside completion transaction). */
  spawnNextOccurrence(input: SpawnNextTaskInput): GardenTask {
    assertRepeatType(input.repeatType);
    assertLocalDate(input.dueDate);
    this.assertSameGarden(input.seasonId, input.areaId, input.plantingId);

    const now = nowIsoUtc();
    const task: GardenTask = {
      id: createId(),
      seasonId: input.seasonId,
      areaId: input.areaId,
      plantingId: input.plantingId,
      type: input.type,
      title: input.title,
      dueDate: input.dueDate,
      completedAt: null,
      repeatType: input.repeatType,
      repeatInterval: input.repeatInterval,
      notes: input.notes,
      completionEventId: null,
      spawnedTaskId: null,
      createdAt: now,
      updatedAt: now,
    };

    this.insertTask(task);
    return task;
  }

  getById(id: string): GardenTask | null {
    try {
      const row = this.db.getFirst<TaskRow>(
        `SELECT * FROM garden_tasks WHERE id = ?`,
        [id]
      );
      return row ? mapTask(row) : null;
    } catch (err) {
      throw new StorageError('Failed to read garden task', err);
    }
  }

  update(id: string, input: UpdateGardenTaskInput): GardenTask {
    const existing = this.getById(id);
    if (!existing) {
      throw new StorageError('Task not found');
    }

    const next: GardenTask = {
      ...existing,
      type: input.type ?? existing.type,
      title: input.title !== undefined ? input.title.trim() : existing.title,
      dueDate: input.dueDate ?? existing.dueDate,
      areaId: input.areaId !== undefined ? input.areaId : existing.areaId,
      plantingId:
        input.plantingId !== undefined ? input.plantingId : existing.plantingId,
      repeatType: input.repeatType ?? existing.repeatType,
      repeatInterval:
        input.repeatInterval !== undefined
          ? input.repeatInterval
          : existing.repeatInterval,
      notes: input.notes !== undefined ? emptyToNull(input.notes) : existing.notes,
      updatedAt: nowIsoUtc(),
    };

    if (next.title.length === 0) {
      throw new StorageError('Task title is required');
    }

    assertWorkType(next.type);
    assertRepeatType(next.repeatType);
    assertLocalDate(next.dueDate);
    assertRepeatInterval(next.repeatType, next.repeatInterval);
    next.repeatInterval = normalizeRepeatInterval(next.repeatType, next.repeatInterval);

    this.assertSameGarden(next.seasonId, next.areaId, next.plantingId);

    try {
      this.db.run(
        `UPDATE garden_tasks SET
           type = ?, title = ?, due_date = ?, area_id = ?, planting_id = ?,
           repeat_type = ?, repeat_interval = ?, notes = ?, updated_at = ?
         WHERE id = ?`,
        [
          next.type,
          next.title,
          next.dueDate,
          next.areaId,
          next.plantingId,
          next.repeatType,
          next.repeatInterval,
          next.notes,
          next.updatedAt,
          id,
        ]
      );
      return next;
    } catch (err) {
      throw new StorageError('Failed to update garden task', err);
    }
  }

  delete(id: string): boolean {
    try {
      const result = this.db.run(`DELETE FROM garden_tasks WHERE id = ?`, [id]);
      return result.changes > 0;
    } catch (err) {
      throw new StorageError('Failed to delete garden task', err);
    }
  }

  /**
   * Marks a task complete and stores provenance links (inside a transaction).
   * Does not create events or spawn occurrences — see taskCompletionService.
   */
  markCompletedWithLinks(
    id: string,
    completedAt: UtcInstant,
    completionEventId: string,
    spawnedTaskId: string | null
  ): GardenTask {
    const existing = this.getById(id);
    if (!existing) {
      throw new StorageError('Task not found');
    }

    const updatedAt = nowIsoUtc();
    try {
      this.db.run(
        `UPDATE garden_tasks SET
           completed_at = ?,
           completion_event_id = ?,
           spawned_task_id = ?,
           updated_at = ?
         WHERE id = ? AND completed_at IS NULL`,
        [completedAt, completionEventId, spawnedTaskId, updatedAt, id]
      );
    } catch (err) {
      throw new StorageError('Failed to mark task completed', err);
    }

    const refreshed = this.getById(id);
    if (!refreshed || refreshed.completedAt === null) {
      throw new StorageError('Task completion conflict — already completed');
    }
    return refreshed;
  }

  /** Clears completion state and provenance links (undo). */
  clearCompletion(id: string): GardenTask {
    const existing = this.getById(id);
    if (!existing) {
      throw new StorageError('Task not found');
    }
    if (existing.completedAt === null) {
      return existing;
    }

    const updatedAt = nowIsoUtc();
    try {
      this.db.run(
        `UPDATE garden_tasks SET
           completed_at = NULL,
           completion_event_id = NULL,
           spawned_task_id = NULL,
           updated_at = ?
         WHERE id = ?`,
        [updatedAt, id]
      );
    } catch (err) {
      throw new StorageError('Failed to reopen task', err);
    }

    const refreshed = this.getById(id);
    if (!refreshed) {
      throw new StorageError('Task missing after reopen');
    }
    return refreshed;
  }

  /** Reopens a completed task without touching linked rows (prefer undoComplete service). */
  reopen(id: string): GardenTask {
    return this.clearCompletion(id);
  }

  postpone(id: string, newDueDate: LocalDate): GardenTask {
    assertLocalDate(newDueDate);
    const existing = this.getById(id);
    if (!existing) {
      throw new StorageError('Task not found');
    }
    if (existing.completedAt !== null) {
      throw new StorageError('Cannot postpone a completed task');
    }
    return this.update(id, { dueDate: newDueDate });
  }

  listBySeason(seasonId: string): GardenTask[] {
    try {
      const rows = this.db.getAll<TaskRow>(
        `SELECT * FROM garden_tasks
         WHERE season_id = ?
         ORDER BY due_date ASC, created_at ASC, id ASC`,
        [seasonId]
      );
      return rows.map(mapTask);
    } catch (err) {
      throw new StorageError('Failed to list tasks by season', err);
    }
  }

  listForDate(seasonId: string, date: LocalDate): GardenTask[] {
    assertLocalDate(date);
    try {
      const rows = this.db.getAll<TaskRow>(
        `SELECT * FROM garden_tasks
         WHERE season_id = ? AND due_date = ? AND completed_at IS NULL
         ORDER BY created_at ASC, id ASC`,
        [seasonId, date]
      );
      return rows.map(mapTask);
    } catch (err) {
      throw new StorageError('Failed to list tasks for date', err);
    }
  }

  listOverdue(seasonId: string, beforeDate: LocalDate): GardenTask[] {
    assertLocalDate(beforeDate);
    try {
      const rows = this.db.getAll<TaskRow>(
        `SELECT * FROM garden_tasks
         WHERE season_id = ? AND due_date < ? AND completed_at IS NULL
         ORDER BY due_date ASC, created_at ASC, id ASC`,
        [seasonId, beforeDate]
      );
      return rows.map(mapTask);
    } catch (err) {
      throw new StorageError('Failed to list overdue tasks', err);
    }
  }

  listUpcoming(
    seasonId: string,
    afterDate: LocalDate,
    withinDays: number
  ): GardenTask[] {
    assertLocalDate(afterDate);
    if (!Number.isInteger(withinDays) || withinDays < 0) {
      throw new StorageError('withinDays must be a non-negative integer');
    }

    const endDate = addDays(afterDate, withinDays);

    try {
      const rows = this.db.getAll<TaskRow>(
        `SELECT * FROM garden_tasks
         WHERE season_id = ?
           AND due_date > ?
           AND due_date <= ?
           AND completed_at IS NULL
         ORDER BY due_date ASC, created_at ASC, id ASC`,
        [seasonId, afterDate, endDate]
      );
      return rows.map(mapTask);
    } catch (err) {
      throw new StorageError('Failed to list upcoming tasks', err);
    }
  }

  listCompletedForDate(seasonId: string, date: LocalDate): GardenTask[] {
    assertLocalDate(date);
    try {
      const rows = this.db.getAll<TaskRow>(
        `SELECT t.* FROM garden_tasks t
         INNER JOIN garden_events e ON e.id = t.completion_event_id
         WHERE t.season_id = ? AND e.event_date = ?
         ORDER BY t.completed_at DESC, t.id DESC`,
        [seasonId, date]
      );
      return rows.map(mapTask);
    } catch (err) {
      throw new StorageError('Failed to list completed tasks for date', err);
    }
  }

  listByArea(areaId: string): GardenTask[] {
    try {
      const rows = this.db.getAll<TaskRow>(
        `SELECT * FROM garden_tasks
         WHERE area_id = ?
         ORDER BY due_date ASC, id ASC`,
        [areaId]
      );
      return rows.map(mapTask);
    } catch (err) {
      throw new StorageError('Failed to list tasks by area', err);
    }
  }

  listByPlanting(plantingId: string): GardenTask[] {
    try {
      const rows = this.db.getAll<TaskRow>(
        `SELECT * FROM garden_tasks
         WHERE planting_id = ?
         ORDER BY due_date ASC, id ASC`,
        [plantingId]
      );
      return rows.map(mapTask);
    } catch (err) {
      throw new StorageError('Failed to list tasks by planting', err);
    }
  }

  private insertTask(task: GardenTask): void {
    this.db.run(
      `INSERT INTO garden_tasks
       (id, season_id, area_id, planting_id, type, title, due_date,
        completed_at, repeat_type, repeat_interval, notes,
        completion_event_id, spawned_task_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        task.id,
        task.seasonId,
        task.areaId,
        task.plantingId,
        task.type,
        task.title,
        task.dueDate,
        task.completedAt,
        task.repeatType,
        task.repeatInterval,
        task.notes,
        task.completionEventId,
        task.spawnedTaskId,
        task.createdAt,
        task.updatedAt,
      ]
    );
  }

  private assertSameGarden(
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
      throw new StorageError('Task references a missing season');
    }
    if (areaId !== null && row.area_garden_id === null) {
      throw new StorageError('Task references a missing garden area');
    }
    if (plantingId !== null && row.planting_season_id === null) {
      throw new StorageError('Task references a missing planting');
    }
    if (
      areaId !== null &&
      row.area_garden_id !== null &&
      row.season_garden_id !== row.area_garden_id
    ) {
      throw new StorageError('Task references entities from different gardens');
    }
    if (
      plantingId !== null &&
      row.planting_season_id !== null &&
      row.planting_season_id !== seasonId
    ) {
      throw new StorageError('Task references planting from a different season');
    }
  }
}

function mapTask(row: TaskRow): GardenTask {
  return {
    id: row.id,
    seasonId: row.season_id,
    areaId: row.area_id,
    plantingId: row.planting_id,
    type: row.type as WorkType,
    title: row.title,
    dueDate: row.due_date,
    completedAt: row.completed_at,
    repeatType: row.repeat_type as RepeatType,
    repeatInterval: row.repeat_interval,
    notes: row.notes,
    completionEventId: row.completion_event_id ?? null,
    spawnedTaskId: row.spawned_task_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function assertWorkType(type: string): asserts type is WorkType {
  if (!(WORK_TYPES as readonly string[]).includes(type)) {
    throw new StorageError(`Invalid work type: ${type}`);
  }
}

function assertRepeatType(type: string): asserts type is RepeatType {
  if (!(REPEAT_TYPES as readonly string[]).includes(type)) {
    throw new StorageError(`Invalid repeat type: ${type}`);
  }
}

function assertLocalDate(value: string): void {
  if (!isValidLocalDateString(value)) {
    throw new StorageError(`Invalid local date: ${value}`);
  }
}

function assertRepeatInterval(
  repeatType: RepeatType,
  interval: number | null
): void {
  if (repeatType === 'every_n_days') {
    if (interval === null || !Number.isInteger(interval) || interval < 1) {
      throw new StorageError('every_n_days requires repeatInterval >= 1');
    }
  }
}

function normalizeRepeatInterval(
  repeatType: RepeatType,
  interval: number | null
): number | null {
  if (repeatType === 'every_n_days') {
    return interval ?? 1;
  }
  return null;
}

function emptyToNull(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function addDays(localDate: string, days: number): string {
  const [y, m, d] = localDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
