/**
 * Atomic harvest operations with linked diary events.
 */

import type { SqlDatabase } from '@/src/db/types';
import type { HarvestUnit } from '@/src/domain/codes';
import { StorageError } from '@/src/domain/errors';
import type { GardenEvent, Harvest, LocalDate } from '@/src/domain/types';
import { GardenEventRepository } from '@/src/repositories/GardenEventRepository';
import { HarvestRepository } from '@/src/repositories/HarvestRepository';
import { PlantingRepository } from '@/src/repositories/PlantingRepository';
import { formatHarvestEventTitle } from '@/src/services/harvestFormat';

export type CreateHarvestInput = {
  seasonId: string;
  plantingId: string;
  date: LocalDate;
  quantity: number;
  unit: HarvestUnit;
  notes?: string | null;
};

export type UpdateHarvestInput = {
  date?: LocalDate;
  quantity?: number;
  unit?: HarvestUnit;
  notes?: string | null;
};

export type CreateHarvestResult = {
  harvest: Harvest;
  event: GardenEvent;
};

/** Creates harvest + linked diary event atomically. */
export function createHarvest(
  db: SqlDatabase,
  input: CreateHarvestInput
): CreateHarvestResult {
  const harvestRepo = new HarvestRepository(db);
  const eventRepo = new GardenEventRepository(db);
  const plantingRepo = new PlantingRepository(db);

  return db.withTransaction(() => {
    const planting = plantingRepo.getById(input.plantingId);
    if (!planting) {
      throw new StorageError('Planting not found');
    }

    const title = formatHarvestEventTitle(input.quantity, input.unit);
    const event = eventRepo.create({
      seasonId: input.seasonId,
      type: 'harvesting',
      title,
      eventDate: input.date,
      areaId: planting.areaId,
      plantingId: planting.id,
      notes: input.notes ?? null,
    });

    const harvest = harvestRepo.create({
      ...input,
      eventId: event.id,
    });

    return { harvest, event };
  });
}

/** Updates harvest and syncs the linked diary event. */
export function updateHarvest(
  db: SqlDatabase,
  harvestId: string,
  input: UpdateHarvestInput
): Harvest {
  const harvestRepo = new HarvestRepository(db);
  const eventRepo = new GardenEventRepository(db);

  return db.withTransaction(() => {
    const existing = harvestRepo.getById(harvestId);
    if (!existing) {
      throw new StorageError('Harvest not found');
    }

    const nextQuantity = input.quantity ?? existing.quantity;
    const nextUnit = input.unit ?? existing.unit;
    const nextDate = input.date ?? existing.date;
    const nextNotes =
      input.notes !== undefined ? input.notes : existing.notes;

    const harvest = harvestRepo.update(harvestId, {
      date: nextDate,
      quantity: nextQuantity,
      unit: nextUnit,
      notes: nextNotes,
    });

    if (existing.eventId) {
      eventRepo.syncHarvestLinked(existing.eventId, {
        title: formatHarvestEventTitle(nextQuantity, nextUnit),
        eventDate: nextDate,
        notes: nextNotes,
      });
    }

    return harvest;
  });
}

/** Deletes harvest and its linked diary event atomically. */
export function deleteHarvest(db: SqlDatabase, harvestId: string): boolean {
  const harvestRepo = new HarvestRepository(db);
  const eventRepo = new GardenEventRepository(db);

  return db.withTransaction(() => {
    const existing = harvestRepo.getById(harvestId);
    if (!existing) {
      return false;
    }

    harvestRepo.delete(harvestId);
    if (existing.eventId) {
      eventRepo.delete(existing.eventId);
    }
    return true;
  });
}
