/**
 * Versioned JSON backup contract for «Моя дача».
 * Backup format version is independent of SQLite schema version.
 */

import type { AppSettings } from '@/src/domain/types';

/** Stable marker written into every backup file. */
export const BACKUP_FORMAT = 'garden-diary-backup' as const;

/** Supported backup format version (serialized contract). */
export const BACKUP_VERSION = 1 as const;

/** Binary photo payload keyed by garden_photos.id. */
export type BackupPhotoFile = {
  extension: string;
  base64: string;
};

/** Raw SQLite row snapshots (snake_case column names). */
export type BackupTableSnapshot = {
  gardens: Record<string, unknown>[];
  seasons: Record<string, unknown>[];
  gardenAreas: Record<string, unknown>[];
  plantCatalogItems: Record<string, unknown>[];
  gardenPlants: Record<string, unknown>[];
  plantings: Record<string, unknown>[];
  gardenTasks: Record<string, unknown>[];
  gardenEvents: Record<string, unknown>[];
  harvests: Record<string, unknown>[];
  expenses: Record<string, unknown>[];
  gardenPhotos: Record<string, unknown>[];
  appSettings: Record<string, unknown>[];
  photoFiles: Record<string, BackupPhotoFile>;
};

export type GardenDiaryBackupV1 = {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  createdAt: string;
  app: {
    package: string | null;
    appVersion: string | null;
  };
  data: BackupTableSnapshot;
};

export type BackupPreview = {
  createdAt: string;
  gardenCount: number;
  seasonCount: number;
  areaCount: number;
  plantingCount: number;
  taskCount: number;
  harvestCount: number;
  expenseCount: number;
  eventCount: number;
  photoCount: number;
};

export type ParsedBackup =
  | { ok: true; backup: GardenDiaryBackupV1; preview: BackupPreview }
  | { ok: false; code: BackupErrorCode; message: string };

export type BackupErrorCode =
  | 'read_failed'
  | 'invalid_json'
  | 'wrong_format'
  | 'unsupported_version'
  | 'corrupted'
  | 'restore_failed';

/** Typed settings reconstructed from raw app_settings rows. */
export type BackupAppSettings = AppSettings;

/** Reads owned photo bytes for backup creation. */
export type BackupPhotoReader = {
  readOwnedPhotoBase64: (
    uri: string
  ) => Promise<BackupPhotoFile | null>;
};

/** Writes photo bytes during restore (before DB transaction). */
export type BackupPhotoWriter = {
  writePhotoFile: (
    photoId: string,
    file: BackupPhotoFile
  ) => Promise<string>;
  deletePhotoFile: (uri: string) => Promise<void>;
};
