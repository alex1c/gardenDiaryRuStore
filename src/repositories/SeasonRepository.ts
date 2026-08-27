/**
 * Season repository — year label is metadata; dates may span calendar years.
 */

import type { SqlDatabase } from '@/src/db/types';
import { StorageError } from '@/src/domain/errors';
import type { LocalDate, Season } from '@/src/domain/types';
import { isValidLocalDateString } from '@/src/utils/localDate';
import { createId } from '@/src/utils/id';
import { nowIsoUtc } from '@/src/utils/timestamps';

type SeasonRow = {
  id: string;
  garden_id: string;
  year: number;
  title: string;
  start_date: string | null;
  end_date: string | null;
  archived: number;
  created_at: string;
  updated_at: string;
};

export type CreateSeasonInput = {
  gardenId: string;
  year: number;
  title: string;
  startDate?: LocalDate | null;
  endDate?: LocalDate | null;
  archived?: boolean;
};

export type UpdateSeasonInput = {
  title?: string;
  year?: number;
  startDate?: LocalDate | null;
  endDate?: LocalDate | null;
  archived?: boolean;
};

export class SeasonRepository {
  constructor(private readonly db: SqlDatabase) {}

  create(input: CreateSeasonInput): Season {
    const title = input.title.trim();
    if (!title) {
      throw new StorageError('Season title is required');
    }
    if (!Number.isInteger(input.year)) {
      throw new StorageError('Season year must be an integer');
    }
    assertOptionalLocalDate(input.startDate);
    assertOptionalLocalDate(input.endDate);

    const now = nowIsoUtc();
    const season: Season = {
      id: createId(),
      gardenId: input.gardenId,
      year: input.year,
      title,
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
      archived: input.archived ?? false,
      createdAt: now,
      updatedAt: now,
    };

    try {
      this.db.run(
        `INSERT INTO seasons
         (id, garden_id, year, title, start_date, end_date, archived, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          season.id,
          season.gardenId,
          season.year,
          season.title,
          season.startDate,
          season.endDate,
          season.archived ? 1 : 0,
          season.createdAt,
          season.updatedAt,
        ]
      );
      return season;
    } catch (err) {
      throw new StorageError('Failed to create season', err);
    }
  }

  getById(id: string): Season | null {
    try {
      const row = this.db.getFirst<SeasonRow>(
        `SELECT id, garden_id, year, title, start_date, end_date, archived, created_at, updated_at
         FROM seasons WHERE id = ?`,
        [id]
      );
      return row ? mapSeason(row) : null;
    } catch (err) {
      throw new StorageError('Failed to get season', err);
    }
  }

  listByGarden(gardenId: string): Season[] {
    try {
      const rows = this.db.getAll<SeasonRow>(
        `SELECT id, garden_id, year, title, start_date, end_date, archived, created_at, updated_at
         FROM seasons
         WHERE garden_id = ?
         ORDER BY year DESC, created_at DESC`,
        [gardenId]
      );
      return rows.map(mapSeason);
    } catch (err) {
      throw new StorageError('Failed to list seasons', err);
    }
  }

  /** Active (non-archived) season with the highest year for a garden. */
  getActiveForGarden(gardenId: string): Season | null {
    try {
      const row = this.db.getFirst<SeasonRow>(
        `SELECT id, garden_id, year, title, start_date, end_date, archived, created_at, updated_at
         FROM seasons
         WHERE garden_id = ? AND archived = 0
         ORDER BY year DESC, created_at DESC
         LIMIT 1`,
        [gardenId]
      );
      return row ? mapSeason(row) : null;
    } catch (err) {
      throw new StorageError('Failed to get active season', err);
    }
  }

  update(id: string, input: UpdateSeasonInput): Season {
    const existing = this.getById(id);
    if (!existing) {
      throw new StorageError(`Season not found: ${id}`);
    }

    assertOptionalLocalDate(input.startDate);
    assertOptionalLocalDate(input.endDate);

    const next: Season = {
      ...existing,
      title: input.title !== undefined ? input.title.trim() : existing.title,
      year: input.year !== undefined ? input.year : existing.year,
      startDate: input.startDate !== undefined ? input.startDate : existing.startDate,
      endDate: input.endDate !== undefined ? input.endDate : existing.endDate,
      archived: input.archived !== undefined ? input.archived : existing.archived,
      updatedAt: nowIsoUtc(),
    };

    if (!next.title) {
      throw new StorageError('Season title is required');
    }

    try {
      this.db.run(
        `UPDATE seasons
         SET year = ?, title = ?, start_date = ?, end_date = ?, archived = ?, updated_at = ?
         WHERE id = ?`,
        [
          next.year,
          next.title,
          next.startDate,
          next.endDate,
          next.archived ? 1 : 0,
          next.updatedAt,
          id,
        ]
      );
      return next;
    } catch (err) {
      throw new StorageError('Failed to update season', err);
    }
  }

  delete(id: string): boolean {
    try {
      const result = this.db.run(`DELETE FROM seasons WHERE id = ?`, [id]);
      return result.changes > 0;
    } catch (err) {
      throw new StorageError('Failed to delete season', err);
    }
  }
}

function mapSeason(row: SeasonRow): Season {
  return {
    id: row.id,
    gardenId: row.garden_id,
    year: row.year,
    title: row.title,
    startDate: row.start_date,
    endDate: row.end_date,
    archived: row.archived === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function assertOptionalLocalDate(value: LocalDate | null | undefined): void {
  if (value === undefined || value === null) return;
  if (!isValidLocalDateString(value)) {
    throw new StorageError(`Invalid local date: ${value}`);
  }
}
