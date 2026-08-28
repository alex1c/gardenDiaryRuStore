/**
 * Garden photo metadata repository — binary files live on disk, not in SQLite.
 */

import type { SqlDatabase } from '@/src/db/types';
import { StorageError } from '@/src/domain/errors';
import type { GardenPhoto, LocalDate, UtcInstant } from '@/src/domain/types';
import { createId } from '@/src/utils/id';
import { isValidLocalDateString } from '@/src/utils/localDate';
import { nowIsoUtc } from '@/src/utils/timestamps';

type PhotoRow = {
  id: string;
  garden_id: string;
  season_id: string | null;
  area_id: string | null;
  planting_id: string | null;
  event_id: string | null;
  uri: string;
  taken_at: string | null;
  caption: string | null;
  created_at: string;
};

export type CreateGardenPhotoInput = {
  gardenId: string;
  uri: string;
  seasonId?: string | null;
  areaId?: string | null;
  plantingId?: string | null;
  eventId?: string | null;
  takenAt?: UtcInstant | null;
  caption?: string | null;
};

export type UpdateGardenPhotoInput = {
  caption?: string | null;
  takenAt?: UtcInstant | null;
};

export class GardenPhotoRepository {
  constructor(private readonly db: SqlDatabase) {}

  create(input: CreateGardenPhotoInput): GardenPhoto {
    if (!input.uri || input.uri.trim().length === 0) {
      throw new StorageError('Photo URI is required');
    }

    this.assertGardenConsistency(
      input.gardenId,
      input.seasonId ?? null,
      input.areaId ?? null,
      input.plantingId ?? null,
      input.eventId ?? null
    );

    const now = nowIsoUtc();
    const photo: GardenPhoto = {
      id: createId(),
      gardenId: input.gardenId,
      seasonId: input.seasonId ?? null,
      areaId: input.areaId ?? null,
      plantingId: input.plantingId ?? null,
      eventId: input.eventId ?? null,
      uri: input.uri,
      takenAt: input.takenAt ?? null,
      caption: emptyToNull(input.caption),
      createdAt: now,
    };

    try {
      this.db.run(
        `INSERT INTO garden_photos
         (id, garden_id, season_id, area_id, planting_id, event_id,
          uri, taken_at, caption, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          photo.id,
          photo.gardenId,
          photo.seasonId,
          photo.areaId,
          photo.plantingId,
          photo.eventId,
          photo.uri,
          photo.takenAt,
          photo.caption,
          photo.createdAt,
        ]
      );
      return photo;
    } catch (err) {
      throw new StorageError('Failed to create garden photo', err);
    }
  }

  getById(id: string): GardenPhoto | null {
    try {
      const row = this.db.getFirst<PhotoRow>(
        `SELECT * FROM garden_photos WHERE id = ?`,
        [id]
      );
      return row ? mapPhoto(row) : null;
    } catch (err) {
      throw new StorageError('Failed to read garden photo', err);
    }
  }

  update(id: string, input: UpdateGardenPhotoInput): GardenPhoto {
    const existing = this.getById(id);
    if (!existing) {
      throw new StorageError('Photo not found');
    }

    const next: GardenPhoto = {
      ...existing,
      caption: input.caption !== undefined ? emptyToNull(input.caption) : existing.caption,
      takenAt: input.takenAt !== undefined ? input.takenAt : existing.takenAt,
    };

    try {
      this.db.run(
        `UPDATE garden_photos SET caption = ?, taken_at = ? WHERE id = ?`,
        [next.caption, next.takenAt, id]
      );
      return next;
    } catch (err) {
      throw new StorageError('Failed to update garden photo', err);
    }
  }

  delete(id: string): boolean {
    try {
      const result = this.db.run(`DELETE FROM garden_photos WHERE id = ?`, [id]);
      return result.changes > 0;
    } catch (err) {
      throw new StorageError('Failed to delete garden photo', err);
    }
  }

  listByGarden(gardenId: string): GardenPhoto[] {
    try {
      const rows = this.db.getAll<PhotoRow>(
        `SELECT * FROM garden_photos WHERE garden_id = ? ORDER BY created_at DESC, id DESC`,
        [gardenId]
      );
      return rows.map(mapPhoto);
    } catch (err) {
      throw new StorageError('Failed to list garden photos', err);
    }
  }

  listByEvent(eventId: string): GardenPhoto[] {
    try {
      const rows = this.db.getAll<PhotoRow>(
        `SELECT * FROM garden_photos WHERE event_id = ? ORDER BY created_at ASC, id ASC`,
        [eventId]
      );
      return rows.map(mapPhoto);
    } catch (err) {
      throw new StorageError('Failed to list photos for event', err);
    }
  }

  listByPlanting(plantingId: string, limit?: number): GardenPhoto[] {
    const capped = normalizeLimit(limit);
    try {
      const rows = this.db.getAll<PhotoRow>(
        `SELECT * FROM garden_photos
         WHERE planting_id = ?
         ORDER BY COALESCE(taken_at, created_at) DESC, id DESC
         LIMIT ?`,
        [plantingId, capped]
      );
      return rows.map(mapPhoto);
    } catch (err) {
      throw new StorageError('Failed to list photos for planting', err);
    }
  }

  listByArea(areaId: string, limit?: number): GardenPhoto[] {
    const capped = normalizeLimit(limit);
    try {
      const rows = this.db.getAll<PhotoRow>(
        `SELECT * FROM garden_photos
         WHERE area_id = ?
         ORDER BY COALESCE(taken_at, created_at) DESC, id DESC
         LIMIT ?`,
        [areaId, capped]
      );
      return rows.map(mapPhoto);
    } catch (err) {
      throw new StorageError('Failed to list photos for area', err);
    }
  }

  /** Generates a deterministic owned filename suffix for tests. */
  buildOwnedFilename(extension = '.jpg'): string {
    return `${createId()}${extension}`;
  }

  private assertGardenConsistency(
    gardenId: string,
    seasonId: string | null,
    areaId: string | null,
    plantingId: string | null,
    eventId: string | null
  ): void {
    if (seasonId !== null) {
      const seasonRow = this.db.getFirst<{ garden_id: string }>(
        `SELECT garden_id FROM seasons WHERE id = ?`,
        [seasonId]
      );
      if (!seasonRow || seasonRow.garden_id !== gardenId) {
        throw new StorageError('Photo season belongs to a different garden');
      }
    }

    if (areaId !== null) {
      const areaRow = this.db.getFirst<{ garden_id: string }>(
        `SELECT garden_id FROM garden_areas WHERE id = ?`,
        [areaId]
      );
      if (!areaRow || areaRow.garden_id !== gardenId) {
        throw new StorageError('Photo area belongs to a different garden');
      }
    }

    if (plantingId !== null) {
      const plantingRow = this.db.getFirst<{ garden_id: string; season_id: string }>(
        `SELECT s.garden_id, p.season_id
         FROM plantings p
         JOIN seasons s ON s.id = p.season_id
         WHERE p.id = ?`,
        [plantingId]
      );
      if (!plantingRow || plantingRow.garden_id !== gardenId) {
        throw new StorageError('Photo planting belongs to a different garden');
      }
      if (seasonId !== null && plantingRow.season_id !== seasonId) {
        throw new StorageError('Photo planting belongs to a different season');
      }
    }

    if (eventId !== null) {
      const eventRow = this.db.getFirst<{ garden_id: string; season_id: string }>(
        `SELECT s.garden_id, e.season_id
         FROM garden_events e
         JOIN seasons s ON s.id = e.season_id
         WHERE e.id = ?`,
        [eventId]
      );
      if (!eventRow || eventRow.garden_id !== gardenId) {
        throw new StorageError('Photo event belongs to a different garden');
      }
      if (seasonId !== null && eventRow.season_id !== seasonId) {
        throw new StorageError('Photo event belongs to a different season');
      }
    }
  }
}

function mapPhoto(row: PhotoRow): GardenPhoto {
  return {
    id: row.id,
    gardenId: row.garden_id,
    seasonId: row.season_id,
    areaId: row.area_id,
    plantingId: row.planting_id,
    eventId: row.event_id,
    uri: row.uri,
    takenAt: row.taken_at,
    caption: row.caption,
    createdAt: row.created_at,
  };
}

function emptyToNull(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function normalizeLimit(limit: number | undefined): number {
  if (limit === undefined) {
    return 500;
  }
  if (!Number.isInteger(limit) || limit < 1) {
    throw new StorageError('Photo list limit must be a positive integer');
  }
  return Math.min(limit, 500);
}

/** Parses optional local date for takenAt fallback in UI — not used in repo create. */
export function localDateToTakenAtFallback(localDate: LocalDate): UtcInstant {
  if (!isValidLocalDateString(localDate)) {
    throw new StorageError(`Invalid local date: ${localDate}`);
  }
  const [y, m, d] = localDate.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0).toISOString();
}
