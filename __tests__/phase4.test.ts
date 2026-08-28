/**
 * Phase 4 tests — diary events, photos, integrity, backdated ordering.
 */

import initSqlJs from 'sql.js';

import { createDatabaseFromClient } from '@/src/db/database';
import { createSqlJsAdapter } from '@/src/db/sqlJsAdapter';
import type { SqlDatabase } from '@/src/db/types';
import { GardenAreaRepository } from '@/src/repositories/GardenAreaRepository';
import { GardenEventRepository } from '@/src/repositories/GardenEventRepository';
import { GardenPhotoRepository } from '@/src/repositories/GardenPhotoRepository';
import { GardenTaskRepository } from '@/src/repositories/GardenTaskRepository';
import { PlantCatalogRepository } from '@/src/repositories/PlantCatalogRepository';
import { PlantingRepository } from '@/src/repositories/PlantingRepository';
import { SeasonRepository } from '@/src/repositories/SeasonRepository';
import { bootstrapGardenWithSeason } from '@/src/services/bootstrapGarden';
import {
  canEditEvent,
  groupEventsByDate,
  isTaskGeneratedEvent,
} from '@/src/services/eventDisplay';
import { completeTask } from '@/src/services/taskCompletionService';
import { isOwnedGardenPhotoUri, getGardenPhotosDirectory } from '@/src/services/photoStorageService';

async function openTestDb(): Promise<SqlDatabase> {
  const SQL = await initSqlJs();
  const raw = new SQL.Database();
  return createDatabaseFromClient(createSqlJsAdapter(raw));
}

type Fixture = {
  db: SqlDatabase;
  gardenId: string;
  seasonId: string;
  areaId: string;
  plantingId: string;
  otherAreaId: string;
};

async function seedFixture(): Promise<Fixture> {
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
  const planting = new PlantingRepository(db).create({
    seasonId: season.id,
    areaId: area.id,
    catalogItemId: item.id,
  });

  const { garden: otherGarden } = bootstrapGardenWithSeason(db, {
    gardenName: 'Другая',
    year: 2026,
  });
  const otherArea = areas.create({
    gardenId: otherGarden.id,
    name: 'Грядка',
    type: 'garden_bed',
  });

  return {
    db,
    gardenId: garden.id,
    seasonId: season.id,
    areaId: area.id,
    plantingId: planting.id,
    otherAreaId: otherArea.id,
  };
}

describe('GardenEvent manual diary', () => {
  test('manual create, edit, delete', async () => {
    const { db, seasonId, areaId } = await seedFixture();
    const events = new GardenEventRepository(db);

    const created = events.create({
      seasonId,
      areaId,
      type: 'observation',
      title: 'Появились цветы',
      eventDate: '2026-08-20',
      notes: 'На нижних листьях',
    });
    expect(created.taskId).toBeNull();
    expect(canEditEvent(created)).toBe(true);

    const updated = events.updateManual(created.id, {
      title: 'Первые цветы',
    });
    expect(updated.title).toBe('Первые цветы');

    expect(events.deleteManual(created.id)).toBe(true);
    expect(events.getById(created.id)).toBeNull();
  });

  test('backdated entry sorts under its calendar day', async () => {
    const { db, seasonId } = await seedFixture();
    const events = new GardenEventRepository(db);

    events.create({
      seasonId,
      type: 'observation',
      title: 'Сегодня',
      eventDate: '2026-08-28',
    });
    events.create({
      seasonId,
      type: 'observation',
      title: 'Раньше',
      eventDate: '2026-08-20',
    });

    const grouped = groupEventsByDate(events.listBySeason(seasonId));
    expect(grouped[0].date).toBe('2026-08-28');
    expect(grouped[1].date).toBe('2026-08-20');
    expect(grouped[1].events[0].title).toBe('Раньше');
  });

  test('listByArea and listByPlanting', async () => {
    const { db, seasonId, areaId, plantingId } = await seedFixture();
    const events = new GardenEventRepository(db);

    events.create({
      seasonId,
      areaId,
      type: 'watering',
      title: 'Полив теплицы',
      eventDate: '2026-08-28',
    });
    events.create({
      seasonId,
      areaId,
      plantingId,
      type: 'observation',
      title: 'Цветы',
      eventDate: '2026-08-25',
    });

    expect(events.listByArea(areaId).map((e) => e.title)).toEqual([
      'Полив теплицы',
      'Цветы',
    ]);
    expect(events.listByPlanting(plantingId).map((e) => e.title)).toEqual(['Цветы']);
  });

  test('rejects cross-garden area on manual event', async () => {
    const { db, seasonId, otherAreaId } = await seedFixture();
    const events = new GardenEventRepository(db);

    expect(() =>
      events.create({
        seasonId,
        areaId: otherAreaId,
        type: 'observation',
        title: 'Bad',
        eventDate: '2026-08-28',
      })
    ).toThrow(/different garden/);
  });

  test('task-generated event is read-only and not deletable', async () => {
    const { db, seasonId } = await seedFixture();
    const tasks = new GardenTaskRepository(db);
    const events = new GardenEventRepository(db);

    const task = tasks.create({
      seasonId,
      title: 'Полить',
      type: 'watering',
      dueDate: '2026-08-28',
    });
    const result = completeTask(db, task.id, '2026-08-28');
    const event = result.event;

    expect(isTaskGeneratedEvent(event)).toBe(true);
    expect(canEditEvent(event)).toBe(false);

    expect(() => events.updateManual(event.id, { title: 'Hack' })).toThrow(
      /cannot be edited/
    );
    expect(() => events.deleteManual(event.id)).toThrow(/cannot be deleted/);
  });
});

describe('GardenPhoto repository', () => {
  test('creates metadata with garden consistency', async () => {
    const { db, gardenId, seasonId, areaId, plantingId } = await seedFixture();
    const photos = new GardenPhotoRepository(db);
    const ownedUri = `${getGardenPhotosDirectory()}${photos.buildOwnedFilename()}`;

    const photo = photos.create({
      gardenId,
      seasonId,
      areaId,
      plantingId,
      uri: ownedUri,
      caption: 'Завязи',
    });

    expect(photo.plantingId).toBe(plantingId);
    expect(isOwnedGardenPhotoUri(ownedUri)).toBe(true);
  });

  test('rejects cross-garden planting on photo', async () => {
    const { db, gardenId, seasonId, otherAreaId } = await seedFixture();
    const photos = new GardenPhotoRepository(db);
    const areas = new GardenAreaRepository(db);
    const otherGardenId = areas.getById(otherAreaId)!.gardenId;
    const otherSeason = new SeasonRepository(db).getActiveForGarden(otherGardenId)!;
    const otherItem = new PlantCatalogRepository(db).create({
      gardenId: otherGardenId,
      speciesName: 'Огурец',
    });
    const otherPlanting = new PlantingRepository(db).create({
      seasonId: otherSeason.id,
      catalogItemId: otherItem.id,
    });

    expect(() =>
      photos.create({
        gardenId,
        seasonId,
        plantingId: otherPlanting.id,
        uri: 'file:///tmp/x.jpg',
      })
    ).toThrow(/different garden/);
  });

  test('delete removes metadata row', async () => {
    const { db, gardenId, seasonId } = await seedFixture();
    const photos = new GardenPhotoRepository(db);
    const photo = photos.create({
      gardenId,
      seasonId,
      uri: 'file:///data/garden-photos/test.jpg',
    });
    expect(photos.delete(photo.id)).toBe(true);
    expect(photos.getById(photo.id)).toBeNull();
  });
});
