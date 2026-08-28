/**
 * Computes the next due date for a recurring garden task.
 * Always advances from the scheduled dueDate, not the completion moment.
 */

import type { RepeatType } from '@/src/domain/codes';
import { StorageError } from '@/src/domain/errors';
import type { LocalDate } from '@/src/domain/types';
import { addDaysToLocalDate } from '@/src/utils/localDate';

/**
 * Returns the next occurrence date after the given scheduled due date.
 * For every_n_days the interval defaults to 1 when missing.
 */
export function computeNextDueDate(
  scheduledDueDate: LocalDate,
  repeatType: RepeatType,
  repeatInterval: number | null
): LocalDate {
  switch (repeatType) {
    case 'daily':
      return addDaysToLocalDate(scheduledDueDate, 1);
    case 'every_n_days': {
      const interval = repeatInterval ?? 1;
      if (!Number.isInteger(interval) || interval < 1) {
        throw new StorageError(
          `every_n_days repeat requires interval >= 1, got ${String(repeatInterval)}`
        );
      }
      return addDaysToLocalDate(scheduledDueDate, interval);
    }
    case 'weekly':
      return addDaysToLocalDate(scheduledDueDate, 7);
    case 'none':
      throw new StorageError('Cannot compute next due date for non-recurring task');
    default: {
      const exhaustive: never = repeatType;
      throw new StorageError(`Unknown repeat type: ${String(exhaustive)}`);
    }
  }
}

/** True when the task should spawn another occurrence after completion. */
export function isRecurringRepeatType(repeatType: RepeatType): boolean {
  return repeatType !== 'none';
}
