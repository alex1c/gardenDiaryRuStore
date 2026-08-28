/**
 * Display helpers for garden tasks and events.
 */

import {
  WORK_TYPE_EMOJI,
  WORK_TYPE_LABELS,
  type WorkType,
} from '@/src/domain/codes';
import type { GardenArea, GardenTask, PlantCatalogItem, Planting } from '@/src/domain/types';

/** Formats task title with an optional work-type emoji prefix. */
export function formatTaskTitle(task: Pick<GardenTask, 'type' | 'title'>): string {
  const emoji = WORK_TYPE_EMOJI[task.type];
  if (!emoji) {
    return task.title;
  }
  return `${emoji} ${task.title}`;
}

/** Returns the Russian work type label without emoji. */
export function formatWorkTypeLabel(type: WorkType): string {
  return WORK_TYPE_LABELS[type];
}

/**
 * Builds a relation subtitle for a task, e.g. "Теплица · Бычье сердце".
 * Returns null when the task applies to the whole garden plot.
 */
export function formatTaskRelationSubtitle(
  task: Pick<GardenTask, 'areaId' | 'plantingId'>,
  areasById: Map<string, GardenArea>,
  plantingsById: Map<string, Planting>,
  catalogById: Map<string, PlantCatalogItem>
): string | null {
  const parts: string[] = [];

  if (task.areaId) {
    const area = areasById.get(task.areaId);
    if (area) {
      parts.push(area.name);
    }
  }

  if (task.plantingId) {
    const planting = plantingsById.get(task.plantingId);
    if (planting) {
      const catalog = catalogById.get(planting.catalogItemId);
      if (catalog) {
        const label = catalog.varietyName ?? catalog.speciesName;
        if (!parts.includes(label)) {
          parts.push(label);
        }
      }
    }
  }

  return parts.length > 0 ? parts.join(' · ') : null;
}

/** Human-readable relation picker label. */
export function formatTaskRelationLabel(
  areaId: string | null,
  plantingId: string | null,
  areasById: Map<string, GardenArea>,
  plantingsById: Map<string, Planting>,
  catalogById: Map<string, PlantCatalogItem>
): string {
  if (!areaId && !plantingId) {
    return 'Весь участок';
  }

  const subtitle = formatTaskRelationSubtitle(
    { areaId, plantingId },
    areasById,
    plantingsById,
    catalogById
  );
  return subtitle ?? 'Привязка';
}
