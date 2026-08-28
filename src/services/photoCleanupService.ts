/**
 * Photo file cleanup coordinated with repository deletes.
 * SQLite and filesystem cannot share a transaction — order is:
 * list URIs → delete DB rows → best-effort file delete.
 */

import type { SqlDatabase } from '@/src/db/types';
import { GardenPhotoRepository } from '@/src/repositories/GardenPhotoRepository';
import { deleteOwnedPhotoFile } from '@/src/services/photoStorageService';

/** Deletes owned files for the given photo metadata rows. */
export async function deletePhotoFiles(
  photos: readonly { uri: string }[]
): Promise<void> {
  for (const photo of photos) {
    await deleteOwnedPhotoFile(photo.uri);
  }
}

/** Removes all photo files for a garden before CASCADE deletes DB rows. */
export async function cleanupGardenPhotoFiles(
  db: SqlDatabase,
  gardenId: string
): Promise<void> {
  const photos = new GardenPhotoRepository(db).listByGarden(gardenId);
  await deletePhotoFiles(photos);
}

/** Deletes photos linked to an event (DB + files). */
export async function deletePhotosForEvent(
  db: SqlDatabase,
  eventId: string
): Promise<void> {
  const repo = new GardenPhotoRepository(db);
  const photos = repo.listByEvent(eventId);
  for (const photo of photos) {
    repo.delete(photo.id);
  }
  await deletePhotoFiles(photos);
}

/** Deletes photos linked to a planting (DB + files). */
export async function deletePhotosForPlanting(
  db: SqlDatabase,
  plantingId: string
): Promise<void> {
  const repo = new GardenPhotoRepository(db);
  const photos = repo.listByPlanting(plantingId);
  for (const photo of photos) {
    repo.delete(photo.id);
  }
  await deletePhotoFiles(photos);
}

/** Deletes a single photo row and its owned file. */
export async function deletePhotoWithFile(
  db: SqlDatabase,
  photoId: string
): Promise<boolean> {
  const repo = new GardenPhotoRepository(db);
  const photo = repo.getById(photoId);
  if (!photo) {
    return false;
  }
  repo.delete(photoId);
  await deleteOwnedPhotoFile(photo.uri);
  return true;
}
