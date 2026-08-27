/**
 * Domain codes / enums for garden diary entities.
 * Stored as TEXT in SQLite — keep values stable across releases.
 */

/** Physical zone types on a garden plot. */
export const GARDEN_AREA_TYPES = [
  'garden_bed',
  'greenhouse',
  'hotbed',
  'flower_bed',
  'orchard',
  'berry_patch',
  'container',
  'other',
] as const;

export type GardenAreaType = (typeof GARDEN_AREA_TYPES)[number];

/** Lifecycle status of a concrete planting. */
export const PLANTING_STATUSES = [
  'planned',
  'sown',
  'growing',
  'harvesting',
  'finished',
  'failed',
] as const;

export type PlantingStatus = (typeof PLANTING_STATUSES)[number];

/** Planned / logged work kinds (tasks and events share the vocabulary). */
export const WORK_TYPES = [
  'watering',
  'feeding',
  'treatment',
  'sowing',
  'transplanting',
  'weeding',
  'pruning',
  'harvesting',
  'other',
] as const;

export type WorkType = (typeof WORK_TYPES)[number];

/** Simple repeat model for tasks (no RRULE yet). */
export const REPEAT_TYPES = [
  'none',
  'daily',
  'every_n_days',
  'weekly',
] as const;

export type RepeatType = (typeof REPEAT_TYPES)[number];

/** Harvest quantity units. */
export const HARVEST_UNITS = ['kg', 'g', 'pcs'] as const;

export type HarvestUnit = (typeof HARVEST_UNITS)[number];

/** Expense categories. */
export const EXPENSE_CATEGORIES = [
  'seeds',
  'seedlings',
  'soil',
  'fertilizers',
  'plant_protection',
  'tools',
  'construction',
  'water',
  'other',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

/** Optional quantity unit for plantings (distinct from harvest units). */
export const QUANTITY_UNITS = ['pcs', 'rows', 'm2', 'other'] as const;

export type QuantityUnit = (typeof QUANTITY_UNITS)[number];

/** Human-readable Russian labels for area types (UI). */
export const GARDEN_AREA_TYPE_LABELS: Record<GardenAreaType, string> = {
  garden_bed: 'Грядка',
  greenhouse: 'Теплица',
  hotbed: 'Парник',
  flower_bed: 'Клумба',
  orchard: 'Сад',
  berry_patch: 'Ягодник',
  container: 'Контейнер',
  other: 'Другое',
};
