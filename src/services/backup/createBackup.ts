/**
 * Creates a versioned JSON backup from the current database state.
 */

import Constants from 'expo-constants';

import type { SqlDatabase } from '@/src/db/types';
import { isOwnedGardenPhotoUri } from '@/src/services/photoStorageService';
import { toLocalDateString } from '@/src/utils/localDate';
import { nowIsoUtc } from '@/src/utils/timestamps';

import { readBackupTableSnapshot } from './backupSnapshot';
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  type BackupPhotoReader,
  type GardenDiaryBackupV1,
} from './backupTypes';

/** Builds a deterministic, filesystem-safe backup filename. */
export function buildBackupFileName(date: Date = new Date()): string {
  const day = toLocalDateString(date);
  return `moya-dacha-backup-${day}.json`;
}

/**
 * Serializes the full app database into backup format v1.
 * DB snapshot is read atomically; photo binaries are collected afterward.
 */
export async function createBackupJson(
  db: SqlDatabase,
  photoReader: BackupPhotoReader
): Promise<GardenDiaryBackupV1> {
  const snapshot = readBackupTableSnapshot(db);
  const photoFiles: Record<string, { extension: string; base64: string }> = {};

  for (const row of snapshot.gardenPhotos) {
    const id = String(row.id ?? '');
    const uri = String(row.uri ?? '');
    if (!id || !uri || !isOwnedGardenPhotoUri(uri)) {
      continue;
    }
    const payload = await photoReader.readOwnedPhotoBase64(uri);
    if (payload) {
      photoFiles[id] = payload;
    }
  }

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: nowIsoUtc(),
    app: {
      package: Constants.expoConfig?.android?.package ?? null,
      appVersion: Constants.expoConfig?.version ?? null,
    },
    data: {
      ...snapshot,
      photoFiles,
    },
  };
}
