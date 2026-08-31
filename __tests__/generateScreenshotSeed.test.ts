/**
 * Generates a polished screenshot demo backup for emulator restore.
 * Run: npm test -- generateScreenshotSeed.test.ts
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

import initSqlJs from 'sql.js';

import { createDatabaseFromClient } from '@/src/db/database';
import { createSqlJsAdapter } from '@/src/db/sqlJsAdapter';
import type { SqlDatabase } from '@/src/db/types';
import { GardenAreaRepository } from '@/src/repositories/GardenAreaRepository';
import { GardenEventRepository } from '@/src/repositories/GardenEventRepository';
import { GardenPhotoRepository } from '@/src/repositories/GardenPhotoRepository';
import { GardenRepository } from '@/src/repositories/GardenRepository';
import { GardenTaskRepository } from '@/src/repositories/GardenTaskRepository';
import { ExpenseRepository } from '@/src/repositories/ExpenseRepository';
import { PlantCatalogRepository } from '@/src/repositories/PlantCatalogRepository';
import { PlantingRepository } from '@/src/repositories/PlantingRepository';
import { SettingsRepository } from '@/src/repositories/SettingsRepository';
import { bootstrapGardenWithSeason } from '@/src/services/bootstrapGarden';
import { createHarvest } from '@/src/services/harvestService';
import { createSeasonWithOptions } from '@/src/services/seasonCloneService';
import { completeTask } from '@/src/services/taskCompletionService';
import { createBackupJson } from '@/src/services/backup/createBackup';
import type { BackupPhotoReader } from '@/src/services/backup/backupTypes';

const TODAY = '2026-08-31';

async function openTestDb(): Promise<{
	db: SqlDatabase;
	raw: InstanceType<Awaited<ReturnType<typeof initSqlJs>>['Database']>;
}> {
	const SQL = await initSqlJs();
	const raw = new SQL.Database();
	return {
		db: createDatabaseFromClient(createSqlJsAdapter(raw)),
		raw,
	};
}

function createPhotoReader(seedBase64: string) {
	const files = new Map<string, { extension: string; base64: string }>();
	const uris = new Map<string, string>();

	const reader: BackupPhotoReader & {
		register: (photoId: string) => string;
	} = {
		async readOwnedPhotoBase64(uri: string) {
			for (const [id, file] of files.entries()) {
				if (uris.get(id) === uri) {
					return file;
				}
			}
			if (seedBase64 && uri.includes('screenshot-seed-photo')) {
				return { extension: '.jpg', base64: seedBase64 };
			}
			return null;
		},
		register(photoId: string) {
			files.set(photoId, { extension: '.jpg', base64: seedBase64 });
			const uri = `file:///data/user/0/com.calculatorplatform.gardendiary/files/garden_photos/${photoId}.jpg`;
			uris.set(photoId, uri);
			return uri;
		},
	};

	return reader;
}

async function seedScreenshotFixture(db: SqlDatabase, photoUri: string | null) {
	const { garden, season: season2026 } = bootstrapGardenWithSeason(db, {
		gardenName: 'Моя дача',
		year: 2026,
	});
	new GardenRepository(db).update(garden.id, { name: 'Моя дача' });

	const areas = new GardenAreaRepository(db);
	const greenhouse = areas.create({
		gardenId: garden.id,
		name: 'Теплица',
		type: 'greenhouse',
	});
	const bed1 = areas.create({
		gardenId: garden.id,
		name: 'Грядка 1',
		type: 'garden_bed',
	});
	const strawberryBed = areas.create({
		gardenId: garden.id,
		name: 'Клубничная грядка',
		type: 'berry_patch',
	});

	const catalog = new PlantCatalogRepository(db);
	const tomato = catalog.create({
		gardenId: garden.id,
		speciesName: 'Томат',
		varietyName: 'Бычье сердце',
	});
	const cucumber = catalog.create({
		gardenId: garden.id,
		speciesName: 'Огурец',
		varietyName: 'Герман F1',
	});
	const strawberry = catalog.create({
		gardenId: garden.id,
		speciesName: 'Клубника',
		varietyName: 'Азия',
	});
	const pepper = catalog.create({
		gardenId: garden.id,
		speciesName: 'Перец',
		varietyName: 'Калифорнийское чудо',
	});

	const plantings = new PlantingRepository(db);
	const tomatoPlanting = plantings.create({
		seasonId: season2026.id,
		catalogItemId: tomato.id,
		areaId: greenhouse.id,
		status: 'growing',
		quantity: 6,
		quantityUnit: 'pcs',
	});
	const cucumberPlanting = plantings.create({
		seasonId: season2026.id,
		catalogItemId: cucumber.id,
		areaId: greenhouse.id,
		status: 'growing',
		quantity: 4,
		quantityUnit: 'pcs',
	});
	const pepperPlanting = plantings.create({
		seasonId: season2026.id,
		catalogItemId: pepper.id,
		areaId: greenhouse.id,
		status: 'growing',
		quantity: 3,
		quantityUnit: 'pcs',
	});
	const strawberryPlanting = plantings.create({
		seasonId: season2026.id,
		catalogItemId: strawberry.id,
		areaId: strawberryBed.id,
		status: 'growing',
		quantity: 12,
		quantityUnit: 'pcs',
	});

	const tasks = new GardenTaskRepository(db);
	tasks.create({
		seasonId: season2026.id,
		title: 'Подкормить томаты',
		type: 'feeding',
		dueDate: '2026-08-28',
		plantingId: tomatoPlanting.id,
		areaId: greenhouse.id,
	});
	tasks.create({
		seasonId: season2026.id,
		title: 'Полить огурцы',
		type: 'watering',
		dueDate: TODAY,
		plantingId: cucumberPlanting.id,
		areaId: greenhouse.id,
	});
	tasks.create({
		seasonId: season2026.id,
		title: 'Проверить клубнику',
		type: 'observation',
		dueDate: TODAY,
		plantingId: strawberryPlanting.id,
		areaId: strawberryBed.id,
	});
	const weedTask = tasks.create({
		seasonId: season2026.id,
		title: 'Прополка грядки',
		type: 'weeding',
		dueDate: '2026-08-30',
		areaId: bed1.id,
	});
	completeTask(db, weedTask.id, '2026-08-30');

	const events = new GardenEventRepository(db);
	const photoEvent = events.create({
		seasonId: season2026.id,
		title: 'Первые созревшие томаты',
		type: 'observation',
		eventDate: '2026-08-20',
		plantingId: tomatoPlanting.id,
		notes: 'Начали краснеть на нижней кисти.',
	});
	events.create({
		seasonId: season2026.id,
		title: 'Обработка от тли',
		type: 'treatment',
		eventDate: '2026-08-15',
		plantingId: pepperPlanting.id,
		notes: 'Мягкое мыльное опрыскивание.',
	});
	events.create({
		seasonId: season2026.id,
		title: 'Подвязка огурцов',
		type: 'other',
		eventDate: '2026-08-25',
		plantingId: cucumberPlanting.id,
	});

	if (photoUri) {
		new GardenPhotoRepository(db).create({
			gardenId: garden.id,
			seasonId: season2026.id,
			eventId: photoEvent.id,
			uri: photoUri,
			caption: 'Теплица, август',
		});
	}
	createHarvest(db, {
		seasonId: season2026.id,
		plantingId: tomatoPlanting.id,
		date: '2026-08-18',
		quantity: 2.4,
		unit: 'kg',
	});
	createHarvest(db, {
		seasonId: season2026.id,
		plantingId: cucumberPlanting.id,
		date: '2026-08-26',
		quantity: 1.8,
		unit: 'kg',
	});
	createHarvest(db, {
		seasonId: season2026.id,
		plantingId: strawberryPlanting.id,
		date: '2026-08-10',
		quantity: 0.9,
		unit: 'kg',
	});

	new ExpenseRepository(db).create({
		seasonId: season2026.id,
		date: '2026-05-12',
		category: 'seedlings',
		amountKopecks: 189000,
		areaId: greenhouse.id,
		notes: 'Рассада томатов и огурцов',
	});
	new ExpenseRepository(db).create({
		seasonId: season2026.id,
		date: '2026-06-03',
		category: 'fertilizers',
		amountKopecks: 76000,
		areaId: bed1.id,
	});
	new ExpenseRepository(db).create({
		seasonId: season2026.id,
		date: '2026-07-20',
		category: 'tools',
		amountKopecks: 145000,
		notes: 'Секатор и перчатки',
	});

	createSeasonWithOptions(db, {
		gardenId: garden.id,
		year: 2025,
		title: 'Сезон 2025',
		sourceSeasonId: season2026.id,
		copyPerennials: false,
	});

	new SettingsRepository(db).patch({
		activeGardenId: garden.id,
		activeSeasonId: season2026.id,
		onboardingCompleted: true,
	});
}

describe('generateScreenshotSeed', () => {
	test('writes screenshot demo backup JSON', async () => {
		const { db, raw } = await openTestDb();
		const masterIconPath = join(process.cwd(), 'assets', 'icon_gpt.png');
		const seedPhotoBase64 = readFileSync(masterIconPath).toString('base64');
		const photoReader = createPhotoReader(seedPhotoBase64);
		const photoUri = photoReader.register('screenshot-seed-photo');

		await seedScreenshotFixture(db, photoUri);
		const backup = await createBackupJson(db, photoReader);

		const outDir = join(process.cwd(), 'release-artifacts');
		mkdirSync(outDir, { recursive: true });
		const outPath = join(outDir, 'screenshot-seed-backup.json');
		writeFileSync(outPath, JSON.stringify(backup, null, 2), 'utf8');
		writeFileSync(join(outDir, 'screenshot-seed.db'), new Uint8Array(raw.export()));

		expect(backup.data.gardens[0]?.name).toBe('Моя дача');
		expect(backup.data.gardenAreas.length).toBeGreaterThanOrEqual(3);
		expect(backup.data.gardenTasks.length).toBeGreaterThanOrEqual(4);
	});
});
