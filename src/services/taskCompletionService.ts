/**
 * Atomic task completion and undo with GardenEvent creation and recurrence.
 */

import type { SqlDatabase } from '@/src/db/types';
import { StorageError } from '@/src/domain/errors';
import type { GardenEvent, GardenTask, LocalDate } from '@/src/domain/types';
import { GardenEventRepository } from '@/src/repositories/GardenEventRepository';
import { GardenTaskRepository } from '@/src/repositories/GardenTaskRepository';
import {
  computeNextDueDate,
  isRecurringRepeatType,
} from '@/src/services/taskRecurrence';
import { toLocalDateString } from '@/src/utils/localDate';
import { nowIsoUtc } from '@/src/utils/timestamps';

export type CompleteTaskResult = {
  task: GardenTask;
  event: GardenEvent;
  nextTask: GardenTask | null;
  /** False when the task was already completed (idempotent no-op). */
  created: boolean;
};

export type UndoCompleteResult = {
  task: GardenTask;
  removedEventId: string | null;
  removedNextTaskId: string | null;
};

/**
 * Completes a task atomically:
 * 1. Creates GardenEvent
 * 2. Spawns next recurring occurrence when applicable
 * 3. Marks task complete with provenance links
 *
 * Repeated calls for an already-completed task are idempotent.
 */
export function completeTask(
  db: SqlDatabase,
  taskId: string,
  eventDate?: LocalDate
): CompleteTaskResult {
  const taskRepo = new GardenTaskRepository(db);
  const eventRepo = new GardenEventRepository(db);

  return db.withTransaction(() => {
    const existing = taskRepo.getById(taskId);
    if (!existing) {
      throw new StorageError('Task not found');
    }

    if (existing.completedAt !== null && existing.completionEventId) {
      const event = eventRepo.getById(existing.completionEventId);
      const nextTask = existing.spawnedTaskId
        ? taskRepo.getById(existing.spawnedTaskId)
        : null;
      if (event) {
        return {
          task: existing,
          event,
          nextTask,
          created: false,
        };
      }
    }

    const resolvedEventDate = eventDate ?? toLocalDateString(new Date());
    const completedAt = nowIsoUtc();

    const event = eventRepo.create({
      seasonId: existing.seasonId,
      areaId: existing.areaId,
      plantingId: existing.plantingId,
      taskId: existing.id,
      type: existing.type,
      title: existing.title,
      eventDate: resolvedEventDate,
      notes: existing.notes,
    });

    let nextTask: GardenTask | null = null;
    if (isRecurringRepeatType(existing.repeatType)) {
      const nextDue = computeNextDueDate(
        existing.dueDate,
        existing.repeatType,
        existing.repeatInterval
      );
      nextTask = taskRepo.spawnNextOccurrence({
        seasonId: existing.seasonId,
        areaId: existing.areaId,
        plantingId: existing.plantingId,
        type: existing.type,
        title: existing.title,
        dueDate: nextDue,
        repeatType: existing.repeatType,
        repeatInterval: existing.repeatInterval,
        notes: existing.notes,
      });
    }

    const task = taskRepo.markCompletedWithLinks(
      existing.id,
      completedAt,
      event.id,
      nextTask?.id ?? null
    );

    return { task, event, nextTask, created: true };
  });
}

/**
 * Undoes a task completion:
 * 1. Deletes spawned next occurrence (if any)
 * 2. Deletes the completion GardenEvent
 * 3. Clears completion fields on the original task
 */
export function undoCompleteTask(
  db: SqlDatabase,
  taskId: string
): UndoCompleteResult {
  const taskRepo = new GardenTaskRepository(db);
  const eventRepo = new GardenEventRepository(db);

  return db.withTransaction(() => {
    const existing = taskRepo.getById(taskId);
    if (!existing) {
      throw new StorageError('Task not found');
    }

    if (existing.completedAt === null) {
      return {
        task: existing,
        removedEventId: null,
        removedNextTaskId: null,
      };
    }

    const removedNextTaskId = existing.spawnedTaskId;
    if (removedNextTaskId) {
      const spawned = taskRepo.getById(removedNextTaskId);
      if (spawned && spawned.completedAt === null) {
        taskRepo.delete(removedNextTaskId);
      }
    }

    const removedEventId = existing.completionEventId;
    if (removedEventId) {
      eventRepo.delete(removedEventId);
    }

    const task = taskRepo.clearCompletion(taskId);
    return { task, removedEventId, removedNextTaskId };
  });
}
