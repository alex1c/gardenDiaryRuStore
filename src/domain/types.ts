/**
 * Domain entity types for the garden diary.
 * Calendar dates are YYYY-MM-DD strings; timestamps are ISO-8601 UTC.
 */

import type {
  ExpenseCategory,
  GardenAreaType,
  HarvestUnit,
  PlantingStatus,
  QuantityUnit,
  RepeatType,
  WorkType,
} from './codes';

/** Local calendar date string (YYYY-MM-DD), never a UTC ISO slice. */
export type LocalDate = string;

/** UTC instant as ISO-8601 string ending with Z (preferred). */
export type UtcInstant = string;

export type Garden = {
  id: string;
  name: string;
  locationName: string | null;
  notes: string | null;
  createdAt: UtcInstant;
  updatedAt: UtcInstant;
};

export type Season = {
  id: string;
  gardenId: string;
  year: number;
  title: string;
  startDate: LocalDate | null;
  endDate: LocalDate | null;
  archived: boolean;
  createdAt: UtcInstant;
  updatedAt: UtcInstant;
};

export type GardenArea = {
  id: string;
  gardenId: string;
  name: string;
  type: GardenAreaType;
  length: number | null;
  width: number | null;
  notes: string | null;
  sortOrder: number;
  createdAt: UtcInstant;
  updatedAt: UtcInstant;
};

/** Catalog culture/variety — not a physical planting. */
export type PlantCatalogItem = {
  id: string;
  gardenId: string;
  speciesName: string;
  varietyName: string | null;
  notes: string | null;
  createdAt: UtcInstant;
  updatedAt: UtcInstant;
};

export type Planting = {
  id: string;
  seasonId: string;
  areaId: string | null;
  catalogItemId: string;
  quantity: number | null;
  quantityUnit: QuantityUnit | null;
  sowingDate: LocalDate | null;
  transplantDate: LocalDate | null;
  harvestStartDate: LocalDate | null;
  status: PlantingStatus;
  notes: string | null;
  createdAt: UtcInstant;
  updatedAt: UtcInstant;
};

export type GardenTask = {
  id: string;
  seasonId: string;
  areaId: string | null;
  plantingId: string | null;
  type: WorkType;
  title: string;
  dueDate: LocalDate;
  completedAt: UtcInstant | null;
  repeatType: RepeatType;
  repeatInterval: number | null;
  notes: string | null;
  createdAt: UtcInstant;
  updatedAt: UtcInstant;
};

export type GardenEvent = {
  id: string;
  seasonId: string;
  areaId: string | null;
  plantingId: string | null;
  taskId: string | null;
  type: WorkType;
  title: string;
  eventDate: LocalDate;
  notes: string | null;
  createdAt: UtcInstant;
  updatedAt: UtcInstant;
};

/**
 * Harvest quantity is a real number in the chosen unit.
 * Money (expenses) uses integer kopecks — see Expense.amountKopecks.
 */
export type Harvest = {
  id: string;
  seasonId: string;
  plantingId: string;
  date: LocalDate;
  quantity: number;
  unit: HarvestUnit;
  notes: string | null;
  createdAt: UtcInstant;
  updatedAt: UtcInstant;
};

export type Expense = {
  id: string;
  seasonId: string;
  areaId: string | null;
  plantingId: string | null;
  date: LocalDate;
  category: ExpenseCategory;
  /** Amount in kopecks (integer). 12345 = 123.45 RUB. */
  amountKopecks: number;
  notes: string | null;
  createdAt: UtcInstant;
  updatedAt: UtcInstant;
};

/**
 * Photo metadata only — binary files live on disk, never as SQLite BLOBs.
 * uri is an app-relative or file:// path managed by a future photo service.
 */
export type GardenPhoto = {
  id: string;
  gardenId: string;
  seasonId: string | null;
  areaId: string | null;
  plantingId: string | null;
  eventId: string | null;
  uri: string;
  takenAt: UtcInstant | null;
  caption: string | null;
  createdAt: UtcInstant;
};

export type ThemePreference = 'system' | 'light' | 'dark';

/**
 * Typed view over the key-value app_settings table.
 * Extra keys can be stored without schema migrations.
 */
export type AppSettings = {
  settingsVersion: number;
  onboardingCompleted: boolean;
  notificationsEnabled: boolean;
  themePreference: ThemePreference;
  activeGardenId: string | null;
  activeSeasonId: string | null;
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  settingsVersion: 1,
  onboardingCompleted: false,
  notificationsEnabled: false,
  themePreference: 'system',
  activeGardenId: null,
  activeSeasonId: null,
};
