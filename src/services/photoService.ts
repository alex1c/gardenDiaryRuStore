/**
 * High-level photo attach flow: picker URI → persistent storage → DB row.
 */

import type { SqlDatabase } from '@/src/db/types';
import { StorageError } from '@/src/domain/errors';
import type { GardenPhoto, LocalDate } from '@/src/domain/types';
import {
  GardenPhotoRepository,
  localDateToTakenAtFallback,
} from '@/src/repositories/GardenPhotoRepository';
import { deleteOwnedPhotoFile, persistPhotoFromSourceUri } from '@/src/services/photoStorageService';

export type SavePhotoInput = {
  gardenId: string;
  sourceUri: string;
  seasonId?: string | null;
  areaId?: string | null;
  plantingId?: string | null;
  eventId?: string | null;
  caption?: string | null;
  takenAtLocalDate?: LocalDate | null;
};

/**
 * Copies the source image into app storage and creates a GardenPhoto row.
 * If DB insert fails, removes the copied file.
 */
export async function saveGardenPhoto(
  db: SqlDatabase,
  input: SavePhotoInput
): Promise<GardenPhoto> {
  const ownedUri = await persistPhotoFromSourceUri(input.sourceUri);
  const repo = new GardenPhotoRepository(db);

  try {
    return repo.create({
      gardenId: input.gardenId,
      uri: ownedUri,
      seasonId: input.seasonId ?? null,
      areaId: input.areaId ?? null,
      plantingId: input.plantingId ?? null,
      eventId: input.eventId ?? null,
      caption: input.caption ?? null,
      takenAt:
        input.takenAtLocalDate !== undefined && input.takenAtLocalDate !== null
          ? localDateToTakenAtFallback(input.takenAtLocalDate)
          : null,
    });
  } catch (err) {
    await deleteOwnedPhotoFile(ownedUri);
    throw err instanceof StorageError
      ? err
      : new StorageError('Failed to save garden photo metadata', err);
  }
}
