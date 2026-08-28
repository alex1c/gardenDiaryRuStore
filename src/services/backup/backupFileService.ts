/**
 * File I/O wrappers for backup share, restore pick, and temp cache cleanup.
 */

import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { StorageError } from '@/src/domain/errors';

import { buildBackupFileName } from './createBackup';
import type { GardenDiaryBackupV1 } from './backupTypes';

const CACHE_BACKUP_NAME = 'moya-dacha-backup-latest.json';
const CACHE_EXPORT_NAME = 'moya-dacha-export.csv';

/** Writes backup JSON to cache and opens Android share sheet. */
export async function shareBackupJson(backup: GardenDiaryBackupV1): Promise<void> {
  const cacheDir = FileSystem.cacheDirectory;
  if (!cacheDir) {
    throw new StorageError('Cache directory is unavailable');
  }

  const datedName = buildBackupFileName(new Date(backup.createdAt));
  const tempPath = `${cacheDir}${CACHE_BACKUP_NAME}`;
  const sharePath = `${cacheDir}${datedName}`;

  const json = JSON.stringify(backup);
  await FileSystem.writeAsStringAsync(tempPath, json, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  await FileSystem.copyAsync({ from: tempPath, to: sharePath });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new StorageError('Sharing is unavailable on this device');
  }

  await Sharing.shareAsync(sharePath, {
    mimeType: 'application/json',
    dialogTitle: 'Сохранить резервную копию',
  });
}

/** Shares a CSV export file via the system sheet. */
export async function shareCsvExport(csvText: string): Promise<void> {
  const cacheDir = FileSystem.cacheDirectory;
  if (!cacheDir) {
    throw new StorageError('Cache directory is unavailable');
  }

  const path = `${cacheDir}${CACHE_EXPORT_NAME}`;
  await FileSystem.writeAsStringAsync(path, csvText, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new StorageError('Sharing is unavailable on this device');
  }

  await Sharing.shareAsync(path, {
    mimeType: 'text/csv',
    dialogTitle: 'Экспорт CSV',
  });
}

export type BackupPickResult =
  | { cancelled: true }
  | { cancelled: false; text: string };

/**
 * Opens document picker for a backup JSON file.
 * Returns cancelled=true when user dismisses the picker.
 */
export async function pickBackupJsonFile(): Promise<BackupPickResult> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/json', 'text/plain'],
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled || !result.assets?.[0]?.uri) {
    return { cancelled: true };
  }

  try {
    const text = await FileSystem.readAsStringAsync(result.assets[0].uri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    return { cancelled: false, text };
  } catch (err) {
    throw new StorageError('Не удалось прочитать файл', err);
  }
}
