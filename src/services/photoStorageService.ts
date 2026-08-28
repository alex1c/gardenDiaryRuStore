/**
 * Persistent app-owned photo file storage.
 * Copies picker/camera URIs into documentDirectory/garden-photos/.
 */

import * as FileSystem from 'expo-file-system/legacy';

import { StorageError } from '@/src/domain/errors';
import { createId } from '@/src/utils/id';

const PHOTOS_SUBDIR = 'garden-photos/';

/** Resolves the absolute directory for owned garden photo files. */
export function getGardenPhotosDirectory(): string {
  const base = FileSystem.documentDirectory;
  if (!base) {
    throw new StorageError('Document directory is unavailable');
  }
  return `${base}${PHOTOS_SUBDIR}`;
}

/** True when uri lives under the app-owned garden-photos directory. */
export function isOwnedGardenPhotoUri(uri: string): boolean {
  try {
    const dir = getGardenPhotosDirectory();
    return uri.startsWith(dir);
  } catch {
    return false;
  }
}

/**
 * Ensures the garden-photos directory exists.
 * Safe to call before every copy operation.
 */
export async function ensureGardenPhotosDirectory(): Promise<string> {
  const dir = getGardenPhotosDirectory();
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  return dir;
}

/**
 * Copies a temporary picker/camera URI into persistent app storage.
 * Returns the new file:// URI to store in GardenPhoto.uri.
 */
export async function persistPhotoFromSourceUri(sourceUri: string): Promise<string> {
  if (!sourceUri || sourceUri.trim().length === 0) {
    throw new StorageError('Photo source URI is empty');
  }

  const dir = await ensureGardenPhotosDirectory();
  const extension = inferExtension(sourceUri);
  const destUri = `${dir}${createId()}${extension}`;

  try {
    await FileSystem.copyAsync({ from: sourceUri, to: destUri });
    return destUri;
  } catch (err) {
    throw new StorageError('Failed to copy photo into app storage', err);
  }
}

/**
 * Deletes an owned photo file. Ignores missing files and non-owned URIs.
 */
export async function deleteOwnedPhotoFile(uri: string): Promise<void> {
  if (!isOwnedGardenPhotoUri(uri)) {
    return;
  }

  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    }
  } catch {
    // Best-effort delete — DB row is the source of truth for metadata.
  }
}

function inferExtension(sourceUri: string): string {
  const lower = sourceUri.toLowerCase();
  if (lower.includes('.png')) {
    return '.png';
  }
  if (lower.includes('.webp')) {
    return '.webp';
  }
  if (lower.includes('.heic')) {
    return '.heic';
  }
  return '.jpg';
}
