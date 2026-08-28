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
  'observation',
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
export const QUANTITY_UNITS = [
  'pcs',
  'bushes',
  'plants',
  'rows',
  'm2',
  'other',
] as const;

export type QuantityUnit = (typeof QUANTITY_UNITS)[number];

/** Russian labels for planting lifecycle statuses (UI). */
export const PLANTING_STATUS_LABELS: Record<PlantingStatus, string> = {
  planned: 'Планируется',
  sown: 'Посеяно',
  growing: 'Растёт',
  harvesting: 'Урожай',
  finished: 'Завершено',
  failed: 'Не удалось',
};

/** Russian labels for planting quantity units (UI). */
export const QUANTITY_UNIT_LABELS: Record<QuantityUnit, string> = {
  pcs: 'шт.',
  bushes: 'кустов',
  plants: 'растений',
  rows: 'рядов',
  m2: 'м²',
  other: 'другое',
};

/** Statuses that still represent an active crop on the plot. */
export const ACTIVE_PLANTING_STATUSES: readonly PlantingStatus[] = [
  'planned',
  'sown',
  'growing',
  'harvesting',
];

/** Russian labels for work / task types (UI). Emoji kept subtle in display helpers. */
export const WORK_TYPE_LABELS: Record<WorkType, string> = {
  watering: 'Полив',
  feeding: 'Подкормка',
  treatment: 'Обработка',
  sowing: 'Посев',
  transplanting: 'Высадка',
  weeding: 'Прополка',
  pruning: 'Обрезка',
  harvesting: 'Сбор урожая',
  observation: 'Наблюдение',
  other: 'Другое',
};

/** Optional emoji prefix for work types (used sparingly in cards). */
export const WORK_TYPE_EMOJI: Record<WorkType, string> = {
  watering: '💧',
  feeding: '🌱',
  treatment: '🛡',
  sowing: '🌾',
  transplanting: '🪴',
  weeding: '🌿',
  pruning: '✂',
  harvesting: '🧺',
  observation: '🌿',
  other: '',
};

/** Russian labels for task repeat options. */
export const REPEAT_TYPE_LABELS: Record<RepeatType, string> = {
  none: 'Не повторять',
  daily: 'Каждый день',
  every_n_days: 'Каждые N дней',
  weekly: 'Каждую неделю',
};

/** Diary manual-entry type options (UI picker). */
export const DIARY_FORM_TYPE_OPTIONS: readonly {
  type: WorkType;
  label: string;
}[] = [
  { type: 'observation', label: 'Наблюдение' },
  { type: 'other', label: 'Работа' },
  { type: 'sowing', label: 'Посев' },
  { type: 'transplanting', label: 'Высадка' },
  { type: 'feeding', label: 'Подкормка' },
  { type: 'treatment', label: 'Обработка' },
  { type: 'watering', label: 'Полив' },
  { type: 'pruning', label: 'Обрезка' },
  { type: 'other', label: 'Другое' },
];

/** Diary timeline filter categories. */
export type DiaryFilterCategory = 'all' | 'works' | 'observations';

export const DIARY_FILTER_LABELS: Record<DiaryFilterCategory, string> = {
  all: 'Все',
  works: 'Работы',
  observations: 'Наблюдения',
};

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
