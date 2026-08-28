/**
 * Phase 3 tests — tasks, completion, recurrence, undo, local dates, migration v2.
 */

import initSqlJs from 'sql.js';

import {
  createDatabaseFromClient,
} from '@/src/db/database';
import { migration001Initial } from '@/src/db/migrations/001_initial';
import { migration002TaskProvenance } from '@/src/db/migrations/002_task_provenance';
import { CURRENT_SCHEMA_VERSION } from '@/src/db/migrations';
import { runMigrations } from '@/src/db/migrate';
import { createSqlJsAdapter } from '@/src/db/sqlJsAdapter';
import type { SqlDatabase } from '@/src/db/types';
import { GardenAreaRepository } from '@/src/repositories/GardenAreaRepository';
import { GardenEventRepository } from '@/src/repositories/GardenEventRepository';
import { GardenTaskRepository } from '@/src/repositories/GardenTaskRepository';
import { PlantCatalogRepository } from '@/src/repositories/PlantCatalogRepository';
import { PlantingRepository } from '@/src/repositories/PlantingRepository';
import { SeasonRepository } from '@/src/repositories/SeasonRepository';
import { bootstrapGardenWithSeason } from '@/src/services/bootstrapGarden';
import {
  completeTask,
  undoCompleteTask,
} from '@/src/services/taskCompletionService';
import { computeNextDueDate } from '@/src/services/taskRecurrence';
import { addDaysToLocalDate, toLocalDateString } from '@/src/utils/localDate';

async function openTestDb(): Promise<SqlDatabase> {
  const SQL = await initSqlJs();
  const raw = new SQL.Database();
  const adapter = createSqlJsAdapter(raw);
  return createDatabaseFromClient(adapter);
}

type GardenFixture = {
  db: SqlDatabase;
  seasonId: string;
  areaId: string;
  plantingId: string;
  otherSeasonId: string;
  otherAreaId: string;
};

async function seedGardenFixture(): Promise<GardenFixture> {
  const db = await openTestDb();
  const { garden, season } = bootstrapGardenWithSeason(db, {
    gardenName: 'Дача',
    year: 2026,
  });
  const areas = new GardenAreaRepository(db);
  const area = areas.create({
    gardenId: garden.id,
    name: 'Теплица',
    type: 'greenhouse',
  });
  const catalog = new PlantCatalogRepository(db);
  const item = catalog.create({
    gardenId: garden.id,
    speciesName: 'Томат',
    varietyName: 'Бычье сердце',
  });
  const plantings = new PlantingRepository(db);
  const planting = plantings.create({
    seasonId: season.id,
    areaId: area.id,
    catalogItemId: item.id,
  });

  const { garden: otherGarden, season: otherSeason } = bootstrapGardenWithSeason(
    db,
    { gardenName: 'Другая дача', year: 2026 }
  );
  const otherArea = areas.create({
    gardenId: otherGarden.id,
    name: 'Грядка',
    type: 'garden_bed',
  });

  return {
    db,
    seasonId: season.id,
    areaId: area.id,
    plantingId: planting.id,
    otherSeasonId: otherSeason.id,
    otherAreaId: otherArea.id,
  };
}

describe('schema migration v2', () => {
  test('v1 database migrates to v2 and preserves garden data', async () => {
    const SQL = await initSqlJs();
    const raw = new SQL.Database();
    const adapter = createSqlJsAdapter(raw);
    adapter.exec('PRAGMA foreign_keys = ON;');

    runMigrations(adapter, [migration001Initial]);
    expect(adapter.getUserVersion()).toBe(1);

    const { garden, season } = bootstrapGardenWithSeason(adapter, {
      gardenName: 'Сохранить',
      year: 2026,
    });

    runMigrations(adapter, [migration001Initial, migration002TaskProvenance]);
    expect(adapter.getUserVersion()).toBe(2);

    const tasks = new GardenTaskRepository(adapter);
    const task = tasks.create({
      seasonId: season.id,
      title: 'После миграции',
      type: 'watering',
      dueDate: '2026-06-01',
    });

    expect(task.completionEventId).toBeNull();
    expect(task.spawnedTaskId).toBeNull();
    expect(new SeasonRepository(adapter).getById(season.id)?.gardenId).toBe(garden.id);
  });

  test('fresh database initializes to schema version 3', async () => {
    const db = await openTestDb();
    expect(db.getUserVersion()).toBe(CURRENT_SCHEMA_VERSION);
    expect(CURRENT_SCHEMA_VERSION).toBe(3);
  });
});

describe('GardenTask repository', () => {
  test('create, update, delete', async () => {
    const { db, seasonId, areaId } = await seedGardenFixture();
    const tasks = new GardenTaskRepository(db);

    const created = tasks.create({
      seasonId,
      areaId,
      title: 'Полить теплицу',
      type: 'watering',
      dueDate: '2026-08-28',
    });
    expect(created.title).toBe('Полить теплицу');

    const updated = tasks.update(created.id, { title: 'Полить всё' });
    expect(updated.title).toBe('Полить всё');

    expect(tasks.delete(created.id)).toBe(true);
    expect(tasks.getById(created.id)).toBeNull();
  });

  test('list today, overdue, upcoming', async () => {
    const { db, seasonId } = await seedGardenFixture();
    const tasks = new GardenTaskRepository(db);
    const today = '2026-08-28';

    tasks.create({
      seasonId,
      title: 'Вчера',
      type: 'other',
      dueDate: '2026-08-27',
    });
    tasks.create({
      seasonId,
      title: 'Сегодня',
      type: 'other',
      dueDate: today,
    });
    tasks.create({
      seasonId,
      title: 'Через 3 дня',
      type: 'other',
      dueDate: '2026-08-31',
    });
    tasks.create({
      seasonId,
      title: 'Через 10 дней',
      type: 'other',
      dueDate: '2026-09-07',
    });

    expect(tasks.listOverdue(seasonId, today).map((t) => t.title)).toEqual([
      'Вчера',
    ]);
    expect(tasks.listForDate(seasonId, today).map((t) => t.title)).toEqual([
      'Сегодня',
    ]);
    expect(tasks.listUpcoming(seasonId, today, 7).map((t) => t.title)).toEqual([
      'Через 3 дня',
    ]);
  });

  test('rejects cross-garden area relation', async () => {
    const { db, seasonId, otherAreaId } = await seedGardenFixture();
    const tasks = new GardenTaskRepository(db);

    expect(() =>
      tasks.create({
        seasonId,
        areaId: otherAreaId,
        title: 'Чужая зона',
        type: 'other',
        dueDate: '2026-08-28',
      })
    ).toThrow(/different gardens/);
  });

  test('rejects cross-season planting relation', async () => {
    const { db, seasonId, otherSeasonId } = await seedGardenFixture();
    const tasks = new GardenTaskRepository(db);

    const otherCatalog = new PlantCatalogRepository(db);
    const otherGardenId = new SeasonRepository(db).getById(otherSeasonId)!.gardenId;
    const otherItem = otherCatalog.create({
      gardenId: otherGardenId,
      speciesName: 'Огурец',
    });
    const otherPlanting = new PlantingRepository(db).create({
      seasonId: otherSeasonId,
      catalogItemId: otherItem.id,
    });

    expect(() =>
      tasks.create({
        seasonId,
        plantingId: otherPlanting.id,
        title: 'Чужая посадка',
        type: 'other',
        dueDate: '2026-08-28',
      })
    ).toThrow(/different season/);
  });

  test('postpone moves due date without completing', async () => {
    const { db, seasonId } = await seedGardenFixture();
    const tasks = new GardenTaskRepository(db);
    const task = tasks.create({
      seasonId,
      title: 'Перенести',
      type: 'other',
      dueDate: '2026-08-28',
      repeatType: 'every_n_days',
      repeatInterval: 3,
    });

    const moved = tasks.postpone(task.id, '2026-08-30');
    expect(moved.dueDate).toBe('2026-08-30');
    expect(moved.repeatType).toBe('every_n_days');
    expect(moved.repeatInterval).toBe(3);
  });
});

describe('task completion', () => {
  test('complete creates GardenEvent and removes task from active lists', async () => {
    const { db, seasonId } = await seedGardenFixture();
    const tasks = new GardenTaskRepository(db);
    const events = new GardenEventRepository(db);
    const today = '2026-08-28';

    const task = tasks.create({
      seasonId,
      title: 'Полить',
      type: 'watering',
      dueDate: today,
    });

    const result = completeTask(db, task.id, today);
    expect(result.created).toBe(true);
    expect(result.event.taskId).toBe(task.id);
    expect(result.nextTask).toBeNull();

    expect(tasks.listForDate(seasonId, today)).toHaveLength(0);
    expect(events.listForDate(seasonId, today)).toHaveLength(1);
    expect(tasks.listCompletedForDate(seasonId, today)).toHaveLength(1);
  });

  test('rolls back when completion transaction fails midway', async () => {
    const { db, seasonId } = await seedGardenFixture();
    const tasks = new GardenTaskRepository(db);
    const events = new GardenEventRepository(db);
    const task = tasks.create({
      seasonId,
      title: 'Rollback',
      type: 'other',
      dueDate: '2026-08-28',
    });

    expect(() => {
      db.withTransaction(() => {
        const eventRepo = new GardenEventRepository(db);
        eventRepo.create({
          seasonId,
          type: 'other',
          title: task.title,
          eventDate: '2026-08-28',
          taskId: task.id,
        });
        throw new Error('simulated failure');
      });
    }).toThrow();

    expect(tasks.getById(task.id)?.completedAt).toBeNull();
    expect(events.listBySeason(seasonId)).toHaveLength(0);
  });
});

describe('recurrence', () => {
  test('daily: 1 → 2 → 3', () => {
    expect(computeNextDueDate('2026-06-01', 'daily', null)).toBe('2026-06-02');
    expect(computeNextDueDate('2026-06-02', 'daily', null)).toBe('2026-06-03');
  });

  test('every 3 days: 1 → 4 → 7', () => {
    expect(computeNextDueDate('2026-06-01', 'every_n_days', 3)).toBe('2026-06-04');
    expect(computeNextDueDate('2026-06-04', 'every_n_days', 3)).toBe('2026-06-07');
  });

  test('weekly: 1 → 8 → 15', () => {
    expect(computeNextDueDate('2026-06-01', 'weekly', null)).toBe('2026-06-08');
    expect(computeNextDueDate('2026-06-08', 'weekly', null)).toBe('2026-06-15');
  });

  test('late completion keeps next date from scheduled dueDate', async () => {
    const { db, seasonId } = await seedGardenFixture();
    const tasks = new GardenTaskRepository(db);

    const task = tasks.create({
      seasonId,
      title: 'Полив',
      type: 'watering',
      dueDate: '2026-06-01',
      repeatType: 'every_n_days',
      repeatInterval: 3,
    });

    const result = completeTask(db, task.id, '2026-06-02');
    expect(result.nextTask?.dueDate).toBe('2026-06-04');
  });

  test('duplicate completion does not create duplicate event or next task', async () => {
    const { db, seasonId } = await seedGardenFixture();
    const events = new GardenEventRepository(db);

    const tasks = new GardenTaskRepository(db);
    const task = tasks.create({
      seasonId,
      title: 'Ежедневно',
      type: 'watering',
      dueDate: '2026-06-01',
      repeatType: 'daily',
    });

    const first = completeTask(db, task.id, '2026-06-01');
    const second = completeTask(db, task.id, '2026-06-01');

    expect(second.created).toBe(false);
    expect(second.event.id).toBe(first.event.id);
    expect(second.nextTask?.id).toBe(first.nextTask?.id);
    expect(events.listBySeason(seasonId)).toHaveLength(1);
    expect(tasks.listBySeason(seasonId).filter((t) => t.completedAt === null)).toHaveLength(1);
  });
});

describe('undo completion', () => {
  test('reopens task, removes event and spawned next occurrence', async () => {
    const { db, seasonId } = await seedGardenFixture();
    const tasks = new GardenTaskRepository(db);
    const events = new GardenEventRepository(db);

    const task = tasks.create({
      seasonId,
      title: 'Полив',
      type: 'watering',
      dueDate: '2026-06-01',
      repeatType: 'daily',
    });

    const completed = completeTask(db, task.id, '2026-06-01');
    expect(completed.nextTask).not.toBeNull();

    const undone = undoCompleteTask(db, task.id);
    expect(undone.task.completedAt).toBeNull();
    expect(undone.removedEventId).toBe(completed.event.id);
    expect(undone.removedNextTaskId).toBe(completed.nextTask!.id);

    expect(events.getById(completed.event.id)).toBeNull();
    expect(tasks.getById(completed.nextTask!.id)).toBeNull();
    expect(tasks.listForDate(seasonId, '2026-06-01')).toHaveLength(1);
  });
});

describe('local calendar dates', () => {
  test('today and tomorrow helpers are stable for a fixed Date', () => {
    const fixed = new Date(2026, 7, 28, 23, 30, 0, 0);
    const today = toLocalDateString(fixed);
    expect(today).toBe('2026-08-28');
    expect(addDaysToLocalDate(today, 1)).toBe('2026-08-29');
  });

  test('leap day arithmetic', () => {
    expect(addDaysToLocalDate('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDaysToLocalDate('2024-02-29', 1)).toBe('2024-03-01');
  });

  test('overdue boundary uses lexicographic local dates', async () => {
    const { db, seasonId } = await seedGardenFixture();
    const tasks = new GardenTaskRepository(db);
    tasks.create({
      seasonId,
      title: 'Due today midnight edge',
      type: 'other',
      dueDate: '2026-08-28',
    });

    expect(tasks.listOverdue(seasonId, '2026-08-28')).toHaveLength(0);
    expect(tasks.listForDate(seasonId, '2026-08-28')).toHaveLength(1);
  });
});
