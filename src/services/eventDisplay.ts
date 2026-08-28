/**
 * Display and integrity helpers for garden diary events.
 */

import {
  WORK_TYPE_EMOJI,
  WORK_TYPE_LABELS,
  type DiaryFilterCategory,
} from '@/src/domain/codes';
import type { GardenEvent } from '@/src/domain/types';
import type { SqlDatabase } from '@/src/db/types';

/** True when the event was created by task completion (task_id is set). */
export function isTaskGeneratedEvent(event: Pick<GardenEvent, 'taskId'>): boolean {
  return event.taskId !== null;
}

/** True when the event was created by harvest recording (linked via harvests.event_id). */
export function isHarvestGeneratedEvent(eventId: string, db: SqlDatabase): boolean {
  const row = db.getFirst<{ id: string }>(
    `SELECT id FROM harvests WHERE event_id = ?`,
    [eventId]
  );
  return row !== null;
}

/** Manual diary entries can be edited; task- and harvest-generated events are read-only. */
export function canEditEvent(
  event: Pick<GardenEvent, 'id' | 'taskId'>,
  options?: { harvestLinked?: boolean }
): boolean {
  if (event.taskId !== null) {
    return false;
  }
  if (options?.harvestLinked) {
    return false;
  }
  return true;
}

/** Formats the event headline with emoji and optional completed-work prefix. */
export function formatEventHeadline(event: Pick<GardenEvent, 'type' | 'taskId'>): string {
  const emoji = WORK_TYPE_EMOJI[event.type];
  const label = WORK_TYPE_LABELS[event.type];
  if (isTaskGeneratedEvent(event)) {
    return `✓ ${label}`;
  }
  if (emoji) {
    return `${emoji} ${label}`;
  }
  return label;
}

/** Applies diary category filter to an in-memory event list. */
export function filterEventsByCategory(
  events: GardenEvent[],
  category: DiaryFilterCategory
): GardenEvent[] {
  if (category === 'all') {
    return events;
  }
  if (category === 'observations') {
    return events.filter((event) => event.type === 'observation');
  }
  return events.filter((event) => event.type !== 'observation');
}

/** Groups events by eventDate preserving descending date order. */
export function groupEventsByDate(
  events: GardenEvent[]
): { date: string; events: GardenEvent[] }[] {
  const map = new Map<string, GardenEvent[]>();
  for (const event of events) {
    const list = map.get(event.eventDate) ?? [];
    list.push(event);
    map.set(event.eventDate, list);
  }

  return [...map.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([date, dateEvents]) => ({ date, events: dateEvents }));
}
