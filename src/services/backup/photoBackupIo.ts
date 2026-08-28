/**
 * Device photo read/write helpers for backup and restore.
 */

import * as FileSystem from 'expo-file-system/legacy';

import { StorageError } from '@/src/domain/errors';
import {
  deleteOwnedPhotoFile,
  ensureGardenPhotosDirectory,
  isOwnedGardenPhotoUri,
} from '@/src/services/photoStorageService';
import { createId } from '@/src/utils/id';

import type { BackupPhotoFile, BackupPhotoReader, BackupPhotoWriter } from './backupTypes';

/** Reads owned garden photo files as base64 for backup export. */
export function createExpoBackupPhotoReader(): BackupPhotoReader {
  return {
    async readOwnedPhotoBase64(uri: string): Promise<BackupPhotoFile | null> {
      if (!isOwnedGardenPhotoUri(uri)) {
        return null;
      }
      try {
        const info = await FileSystem.getInfoAsync(uri);
        if (!info.exists) {
          return null;
        }
        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        return {
          extension: inferExtension(uri),
          base64,
        };
      } catch {
        return null;
      }
    },
  };
}

/** Writes base64 photo payloads back into app-owned storage on restore. */
export function createExpoBackupPhotoWriter(): BackupPhotoWriter {
  return {
    async writePhotoFile(_photoId: string, file: BackupPhotoFile): Promise<string> {
      const dir = await ensureGardenPhotosDirectory();
      // Never derive a path from untrusted backup IDs and never overwrite an
      // existing photo. This unique app-owned path is safe to reference from
      // the restored DB immediately; old files remain recoverable on failure.
      const destUri = `${dir}restore-${createId()}${normalizeExtension(file.extension)}`;
      try {
        await FileSystem.writeAsStringAsync(destUri, file.base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        return destUri;
      } catch (err) {
        throw new StorageError('Failed to restore photo file', err);
      }
    },
    async deletePhotoFile(uri: string): Promise<void> {
      await deleteOwnedPhotoFile(uri);
    },
  };
}

function inferExtension(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.png')) {
    return '.png';
  }
  if (lower.endsWith('.webp')) {
    return '.webp';
  }
  if (lower.endsWith('.heic')) {
    return '.heic';
  }
  return '.jpg';
}

function normalizeExtension(ext: string): string {
  const normalized = ext.toLowerCase().startsWith('.')
    ? ext.toLowerCase()
    : `.${ext.toLowerCase()}`;
  return ['.jpg', '.jpeg', '.png', '.webp', '.heic'].includes(normalized)
    ? normalized
    : '.jpg';
}
