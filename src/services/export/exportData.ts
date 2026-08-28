/**
 * Human-readable CSV export — not restorable backup data.
 */

import type { SqlDatabase } from '@/src/db/types';
import {
  EXPENSE_CATEGORY_LABELS,
  PLANTING_STATUS_LABELS,
  WORK_TYPE_LABELS,
} from '@/src/domain/codes';
import { toLocalDateString } from '@/src/utils/localDate';

import {
  buildCsvRow,
  formatRublesForCsv,
  withUtf8Bom,
} from './csv';

const HEADERS = [
  'record_type',
  'season',
  'date',
  'area',
  'culture',
  'variety',
  'type',
  'title',
  'status',
  'quantity',
  'unit',
  'amount_rub',
  'notes',
] as const;

type ExportContext = {
  areas: Map<string, string>;
  catalog: Map<string, { species: string; variety: string | null }>;
  plantings: Map<string, { catalogId: string; areaId: string | null }>;
};

/** Exports flattened season activity as one semicolon-separated CSV file. */
export function exportGardenCsv(db: SqlDatabase): string {
  const ctx = buildContext(db);
  const rows: string[] = [buildCsvRow([...HEADERS])];

  const cell = (value: unknown): string | number | null | undefined => {
    if (value === null || value === undefined || value === '') {
      return '';
    }
    if (typeof value === 'number') {
      return value;
    }
    return String(value);
  };

  for (const row of db.getAll<Record<string, unknown>>(
    `SELECT p.*, s.title AS season_title
     FROM plantings p
     JOIN seasons s ON s.id = p.season_id
     ORDER BY s.year DESC, p.created_at ASC`
  )) {
    const catalog = ctx.catalog.get(String(row.catalog_item_id));
    rows.push(
      buildCsvRow([
        'planting',
        cell(row.season_title),
        cell(row.sowing_date ?? row.transplant_date),
        labelArea(ctx, row.area_id),
        catalog?.species ?? '',
        catalog?.variety ?? '',
        '',
        '',
        PLANTING_STATUS_LABELS[row.status as keyof typeof PLANTING_STATUS_LABELS] ?? cell(row.status),
        cell(row.quantity),
        cell(row.quantity_unit),
        '',
        cell(row.notes),
      ])
    );
  }

  for (const row of db.getAll<Record<string, unknown>>(
    `SELECT t.*, s.title AS season_title
     FROM garden_tasks t
     JOIN seasons s ON s.id = t.season_id
     ORDER BY t.due_date DESC`
  )) {
    const planting = row.planting_id
      ? ctx.plantings.get(String(row.planting_id))
      : null;
    const catalog = planting ? ctx.catalog.get(planting.catalogId) : null;
    rows.push(
      buildCsvRow([
        'task',
        cell(row.season_title),
        cell(row.due_date),
        labelArea(ctx, row.area_id ?? planting?.areaId),
        catalog?.species ?? '',
        catalog?.variety ?? '',
        WORK_TYPE_LABELS[row.type as keyof typeof WORK_TYPE_LABELS] ?? cell(row.type),
        cell(row.title),
        row.completed_at ? 'completed' : 'planned',
        '',
        '',
        '',
        cell(row.notes),
      ])
    );
  }

  for (const row of db.getAll<Record<string, unknown>>(
    `SELECT e.*, s.title AS season_title
     FROM garden_events e
     JOIN seasons s ON s.id = e.season_id
     ORDER BY e.event_date DESC`
  )) {
    const planting = row.planting_id
      ? ctx.plantings.get(String(row.planting_id))
      : null;
    const catalog = planting ? ctx.catalog.get(planting.catalogId) : null;
    rows.push(
      buildCsvRow([
        'event',
        cell(row.season_title),
        cell(row.event_date),
        labelArea(ctx, row.area_id ?? planting?.areaId),
        catalog?.species ?? '',
        catalog?.variety ?? '',
        WORK_TYPE_LABELS[row.type as keyof typeof WORK_TYPE_LABELS] ?? cell(row.type),
        cell(row.title),
        '',
        '',
        '',
        '',
        cell(row.notes),
      ])
    );
  }

  for (const row of db.getAll<Record<string, unknown>>(
    `SELECT h.*, s.title AS season_title
     FROM harvests h
     JOIN seasons s ON s.id = h.season_id
     ORDER BY h.date DESC`
  )) {
    const planting = ctx.plantings.get(String(row.planting_id));
    const catalog = planting ? ctx.catalog.get(planting.catalogId) : null;
    rows.push(
      buildCsvRow([
        'harvest',
        cell(row.season_title),
        cell(row.date),
        planting ? labelArea(ctx, planting.areaId) : '',
        catalog?.species ?? '',
        catalog?.variety ?? '',
        '',
        '',
        '',
        String(row.quantity).replace('.', ','),
        cell(row.unit),
        '',
        cell(row.notes),
      ])
    );
  }

  for (const row of db.getAll<Record<string, unknown>>(
    `SELECT e.*, s.title AS season_title
     FROM expenses e
     JOIN seasons s ON s.id = e.season_id
     ORDER BY e.date DESC`
  )) {
    const planting = row.planting_id
      ? ctx.plantings.get(String(row.planting_id))
      : null;
    const catalog = planting ? ctx.catalog.get(planting.catalogId) : null;
    rows.push(
      buildCsvRow([
        'expense',
        cell(row.season_title),
        cell(row.date),
        labelArea(ctx, row.area_id ?? planting?.areaId),
        catalog?.species ?? '',
        catalog?.variety ?? '',
        EXPENSE_CATEGORY_LABELS[row.category as keyof typeof EXPENSE_CATEGORY_LABELS] ?? cell(row.category),
        '',
        '',
        '',
        '',
        formatRublesForCsv(Number(row.amount_kopecks)),
        cell(row.notes),
      ])
    );
  }

  return withUtf8Bom(rows.join('\n'));
}

function buildContext(db: SqlDatabase): ExportContext {
  const areas = new Map<string, string>();
  for (const row of db.getAll<{ id: string; name: string }>('SELECT id, name FROM garden_areas')) {
    areas.set(row.id, row.name);
  }

  const catalog = new Map<string, { species: string; variety: string | null }>();
  for (const row of db.getAll<{
    id: string;
    species_name: string;
    variety_name: string | null;
  }>('SELECT id, species_name, variety_name FROM plant_catalog_items')) {
    catalog.set(row.id, { species: row.species_name, variety: row.variety_name });
  }

  const plantings = new Map<string, { catalogId: string; areaId: string | null }>();
  for (const row of db.getAll<{
    id: string;
    catalog_item_id: string;
    area_id: string | null;
  }>('SELECT id, catalog_item_id, area_id FROM plantings')) {
    plantings.set(row.id, {
      catalogId: row.catalog_item_id,
      areaId: row.area_id,
    });
  }

  return { areas, catalog, plantings };
}

function labelArea(ctx: ExportContext, areaId: unknown): string {
  if (areaId == null || areaId === '') {
    return '';
  }
  return ctx.areas.get(String(areaId)) ?? '';
}

export function buildExportFileName(date: Date = new Date()): string {
  return `moya-dacha-export-${toLocalDateString(date)}.csv`;
}
