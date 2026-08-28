/**
 * Expense repository — CRUD and list queries for season expenses.
 * Amounts are stored as integer kopecks (amount_kopecks).
 */

import type { SqlDatabase } from '@/src/db/types';
import {
  EXPENSE_CATEGORIES,
  type ExpenseCategory,
} from '@/src/domain/codes';
import { StorageError } from '@/src/domain/errors';
import type { Expense, LocalDate } from '@/src/domain/types';
import { createId } from '@/src/utils/id';
import { compareLocalDates, isValidLocalDateString } from '@/src/utils/localDate';
import { nowIsoUtc } from '@/src/utils/timestamps';

type ExpenseRow = {
  id: string;
  season_id: string;
  area_id: string | null;
  planting_id: string | null;
  date: string;
  category: string;
  amount_kopecks: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateExpenseInput = {
  seasonId: string;
  date: LocalDate;
  category: ExpenseCategory;
  amountKopecks: number;
  areaId?: string | null;
  plantingId?: string | null;
  notes?: string | null;
};

export type UpdateExpenseInput = {
  date?: LocalDate;
  category?: ExpenseCategory;
  amountKopecks?: number;
  areaId?: string | null;
  plantingId?: string | null;
  notes?: string | null;
};

export type ExpenseListOptions = {
  fromDate?: LocalDate;
  toDate?: LocalDate;
  limit?: number;
  offset?: number;
};

const DEFAULT_LIST_LIMIT = 200;

export class ExpenseRepository {
  constructor(private readonly db: SqlDatabase) {}

  create(input: CreateExpenseInput): Expense {
    assertExpenseCategory(input.category);
    assertLocalDate(input.date);
    assertPositiveKopecks(input.amountKopecks);
    this.assertSeasonConsistency(
      input.seasonId,
      input.areaId ?? null,
      input.plantingId ?? null
    );

    const resolvedAreaId = this.resolveAreaId(
      input.areaId ?? null,
      input.plantingId ?? null
    );

    const now = nowIsoUtc();
    const expense: Expense = {
      id: createId(),
      seasonId: input.seasonId,
      areaId: resolvedAreaId,
      plantingId: input.plantingId ?? null,
      date: input.date,
      category: input.category,
      amountKopecks: input.amountKopecks,
      notes: emptyToNull(input.notes),
      createdAt: now,
      updatedAt: now,
    };

    try {
      this.db.run(
        `INSERT INTO expenses
         (id, season_id, area_id, planting_id, date, category,
          amount_kopecks, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          expense.id,
          expense.seasonId,
          expense.areaId,
          expense.plantingId,
          expense.date,
          expense.category,
          expense.amountKopecks,
          expense.notes,
          expense.createdAt,
          expense.updatedAt,
        ]
      );
      return expense;
    } catch (err) {
      throw new StorageError('Failed to create expense', err);
    }
  }

  getById(id: string): Expense | null {
    try {
      const row = this.db.getFirst<ExpenseRow>(
        `SELECT * FROM expenses WHERE id = ?`,
        [id]
      );
      return row ? mapExpense(row) : null;
    } catch (err) {
      throw new StorageError('Failed to read expense', err);
    }
  }

  update(id: string, input: UpdateExpenseInput): Expense {
    const existing = this.getById(id);
    if (!existing) {
      throw new StorageError('Expense not found');
    }

    const plantingId =
      input.plantingId !== undefined ? input.plantingId : existing.plantingId;
    const areaId =
      input.areaId !== undefined ? input.areaId : existing.areaId;

    this.assertSeasonConsistency(existing.seasonId, areaId, plantingId);

    const next: Expense = {
      ...existing,
      date: input.date ?? existing.date,
      category: input.category ?? existing.category,
      amountKopecks: input.amountKopecks ?? existing.amountKopecks,
      areaId: this.resolveAreaId(areaId, plantingId),
      plantingId,
      notes: input.notes !== undefined ? emptyToNull(input.notes) : existing.notes,
      updatedAt: nowIsoUtc(),
    };

    assertExpenseCategory(next.category);
    assertLocalDate(next.date);
    assertPositiveKopecks(next.amountKopecks);

    try {
      this.db.run(
        `UPDATE expenses SET
           area_id = ?, planting_id = ?, date = ?, category = ?,
           amount_kopecks = ?, notes = ?, updated_at = ?
         WHERE id = ?`,
        [
          next.areaId,
          next.plantingId,
          next.date,
          next.category,
          next.amountKopecks,
          next.notes,
          next.updatedAt,
          id,
        ]
      );
      return next;
    } catch (err) {
      throw new StorageError('Failed to update expense', err);
    }
  }

  delete(id: string): boolean {
    try {
      const result = this.db.run(`DELETE FROM expenses WHERE id = ?`, [id]);
      return result.changes > 0;
    } catch (err) {
      throw new StorageError('Failed to delete expense', err);
    }
  }

  listBySeason(
    seasonId: string,
    options: ExpenseListOptions = {}
  ): Expense[] {
    return this.queryExpenses('season_id = ?', [seasonId], options);
  }

  listByDateRange(
    seasonId: string,
    fromDate: LocalDate,
    toDate: LocalDate,
    options: Omit<ExpenseListOptions, 'fromDate' | 'toDate'> = {}
  ): Expense[] {
    assertLocalDate(fromDate);
    assertLocalDate(toDate);
    if (compareLocalDates(fromDate, toDate) > 0) {
      throw new StorageError('fromDate must be on or before toDate');
    }
    return this.queryExpenses(
      'season_id = ? AND date >= ? AND date <= ?',
      [seasonId, fromDate, toDate],
      options
    );
  }

  listByCategory(seasonId: string, category: ExpenseCategory): Expense[] {
    assertExpenseCategory(category);
    return this.queryExpenses('season_id = ? AND category = ?', [
      seasonId,
      category,
    ]);
  }

  listByArea(areaId: string, limit?: number): Expense[] {
    return this.queryExpenses(
      'area_id = ? OR planting_id IN (SELECT id FROM plantings WHERE area_id = ?)',
      [areaId, areaId],
      { limit: limit ?? DEFAULT_LIST_LIMIT }
    );
  }

  listByPlanting(plantingId: string, limit?: number): Expense[] {
    return this.queryExpenses('planting_id = ?', [plantingId], {
      limit: limit ?? DEFAULT_LIST_LIMIT,
    });
  }

  /** Sums kopecks grouped by category for a season. */
  totalsByCategory(seasonId: string): { category: ExpenseCategory; totalKopecks: number }[] {
    try {
      const rows = this.db.getAll<{ category: string; total: number }>(
        `SELECT category, SUM(amount_kopecks) AS total
         FROM expenses WHERE season_id = ?
         GROUP BY category
         ORDER BY total DESC`,
        [seasonId]
      );
      return rows.map((row) => ({
        category: row.category as ExpenseCategory,
        totalKopecks: row.total,
      }));
    } catch (err) {
      throw new StorageError('Failed to sum expenses by category', err);
    }
  }

  /** Sums kopecks grouped by resolved area for a season. */
  totalsByArea(
    seasonId: string
  ): { areaId: string; areaName: string; totalKopecks: number }[] {
    try {
      const rows = this.db.getAll<{
        area_id: string;
        area_name: string;
        total: number;
      }>(
        `SELECT a.id AS area_id, a.name AS area_name, SUM(e.amount_kopecks) AS total
         FROM expenses e
         LEFT JOIN plantings p ON p.id = e.planting_id
         JOIN garden_areas a ON a.id = COALESCE(e.area_id, p.area_id)
         WHERE e.season_id = ?
         GROUP BY a.id
         ORDER BY total DESC`,
        [seasonId]
      );
      return rows.map((row) => ({
        areaId: row.area_id,
        areaName: row.area_name,
        totalKopecks: row.total,
      }));
    } catch (err) {
      throw new StorageError('Failed to sum expenses by area', err);
    }
  }

  /** Sums kopecks for expenses with no area or planting link. */
  totalCommonExpenses(seasonId: string): number {
    try {
      const row = this.db.getFirst<{ total: number | null }>(
        `SELECT SUM(amount_kopecks) AS total
         FROM expenses
         WHERE season_id = ?
           AND area_id IS NULL
           AND planting_id IS NULL`,
        [seasonId]
      );
      return row?.total ?? 0;
    } catch (err) {
      throw new StorageError('Failed to sum common expenses', err);
    }
  }

  /** Sums kopecks grouped by planting for a season. */
  totalsByPlanting(
    seasonId: string
  ): { plantingId: string; totalKopecks: number }[] {
    try {
      const rows = this.db.getAll<{ planting_id: string; total: number }>(
        `SELECT planting_id, SUM(amount_kopecks) AS total
         FROM expenses
         WHERE season_id = ? AND planting_id IS NOT NULL
         GROUP BY planting_id
         ORDER BY total DESC`,
        [seasonId]
      );
      return rows.map((row) => ({
        plantingId: row.planting_id,
        totalKopecks: row.total,
      }));
    } catch (err) {
      throw new StorageError('Failed to sum expenses by planting', err);
    }
  }

  /** Total season expenses in kopecks. */
  totalBySeason(seasonId: string): number {
    try {
      const row = this.db.getFirst<{ total: number | null }>(
        `SELECT SUM(amount_kopecks) AS total FROM expenses WHERE season_id = ?`,
        [seasonId]
      );
      return row?.total ?? 0;
    } catch (err) {
      throw new StorageError('Failed to sum season expenses', err);
    }
  }

  private queryExpenses(
    whereClause: string,
    params: unknown[],
    options: ExpenseListOptions = {}
  ): Expense[] {
    let sql = `SELECT * FROM expenses WHERE ${whereClause}`;
    const queryParams = [...params];

    if (options.fromDate) {
      assertLocalDate(options.fromDate);
      sql += ` AND date >= ?`;
      queryParams.push(options.fromDate);
    }
    if (options.toDate) {
      assertLocalDate(options.toDate);
      sql += ` AND date <= ?`;
      queryParams.push(options.toDate);
    }

    sql += ` ORDER BY date DESC, created_at DESC, id DESC`;

    const limit = options.limit ?? DEFAULT_LIST_LIMIT;
    const offset = options.offset ?? 0;
    sql += ` LIMIT ? OFFSET ?`;
    queryParams.push(limit, offset);

    try {
      const rows = this.db.getAll<ExpenseRow>(sql, queryParams);
      return rows.map(mapExpense);
    } catch (err) {
      throw new StorageError('Failed to list expenses', err);
    }
  }

  private resolveAreaId(
    areaId: string | null,
    plantingId: string | null
  ): string | null {
    if (plantingId) {
      const planting = this.db.getFirst<{ area_id: string | null }>(
        `SELECT area_id FROM plantings WHERE id = ?`,
        [plantingId]
      );
      if (!planting) {
        throw new StorageError('Expense references a missing planting');
      }
      if (areaId !== null && planting.area_id !== null && areaId !== planting.area_id) {
        throw new StorageError('Expense area does not match planting area');
      }
      return areaId ?? planting.area_id;
    }
    return areaId;
  }

  private assertSeasonConsistency(
    seasonId: string,
    areaId: string | null,
    plantingId: string | null
  ): void {
    const row = this.db.getFirst<{
      season_garden_id: string;
      area_garden_id: string | null;
      planting_season_id: string | null;
    }>(
      `SELECT s.garden_id AS season_garden_id,
              a.garden_id AS area_garden_id,
              p.season_id AS planting_season_id
       FROM seasons s
       LEFT JOIN garden_areas a ON a.id = ?
       LEFT JOIN plantings p ON p.id = ?
       WHERE s.id = ?`,
      [areaId, plantingId, seasonId]
    );

    if (!row) {
      throw new StorageError('Expense references a missing season');
    }
    if (areaId !== null && row.area_garden_id === null) {
      throw new StorageError('Expense references a missing garden area');
    }
    if (plantingId !== null && row.planting_season_id === null) {
      throw new StorageError('Expense references a missing planting');
    }
    if (
      areaId !== null &&
      row.area_garden_id !== null &&
      row.season_garden_id !== row.area_garden_id
    ) {
      throw new StorageError('Expense references area from a different garden');
    }
    if (
      plantingId !== null &&
      row.planting_season_id !== null &&
      row.planting_season_id !== seasonId
    ) {
      throw new StorageError('Expense references planting from a different season');
    }
  }
}

function mapExpense(row: ExpenseRow): Expense {
  return {
    id: row.id,
    seasonId: row.season_id,
    areaId: row.area_id,
    plantingId: row.planting_id,
    date: row.date,
    category: row.category as ExpenseCategory,
    amountKopecks: row.amount_kopecks,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function assertExpenseCategory(category: string): asserts category is ExpenseCategory {
  if (!(EXPENSE_CATEGORIES as readonly string[]).includes(category)) {
    throw new StorageError(`Invalid expense category: ${category}`);
  }
}

function assertLocalDate(value: string): void {
  if (!isValidLocalDateString(value)) {
    throw new StorageError(`Invalid local date: ${value}`);
  }
}

function assertPositiveKopecks(kopecks: number): void {
  if (!Number.isSafeInteger(kopecks) || kopecks <= 0) {
    throw new StorageError('Expense amount must be a positive integer kopecks value');
  }
}

function emptyToNull(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}
