/**
 * Harvest quantity formatting and weight aggregation.
 *
 * Rules:
 * - kg + g normalize to integer grams internally;
 * - pcs stay separate — never mix with weight totals;
 * - display uses Russian decimal comma;
 * - aggregated weight: >= 1000 g → kg, else grams.
 */

import {
  HARVEST_UNITS,
  HARVEST_UNIT_LABELS,
  type HarvestUnit,
  type QuantityUnit,
} from '@/src/domain/codes';
import type { Harvest } from '@/src/domain/types';
import { formatDecimalForDisplay } from '@/src/utils/numeric';

/** Quantity units that represent countable plants for yield-per-plant. */
export const PLANT_COUNT_QUANTITY_UNITS: readonly QuantityUnit[] = [
  'pcs',
  'bushes',
  'plants',
];

export type WeightTotals = {
  /** Total weight stored as integer grams to avoid float drift. */
  grams: number;
};

export type PieceTotals = {
  pieces: number;
};

export type MixedHarvestTotals = {
  weight: WeightTotals | null;
  pieces: PieceTotals | null;
};

/** Converts a harvest quantity to integer grams; null for non-weight units. */
export function harvestQuantityToGrams(
  quantity: number,
  unit: HarvestUnit
): number | null {
  if (unit === 'kg') {
    return Math.round(quantity * 1000);
  }
  if (unit === 'g') {
    return Math.round(quantity);
  }
  return null;
}

/** Sums weight harvest rows into integer grams. Ignores pcs rows. */
export function sumWeightGrams(
  rows: readonly Pick<Harvest, 'quantity' | 'unit'>[]
): number {
  let total = 0;
  for (const row of rows) {
    const grams = harvestQuantityToGrams(row.quantity, row.unit);
    if (grams !== null) {
      total += grams;
    }
  }
  return total;
}

/** Sums piece harvest rows. Ignores weight rows. */
export function sumPieces(
  rows: readonly Pick<Harvest, 'quantity' | 'unit'>[]
): number {
  let total = 0;
  for (const row of rows) {
    if (row.unit === 'pcs') {
      total += row.quantity;
    }
  }
  return total;
}

/** Builds separate weight and piece totals from harvest rows. */
export function aggregateMixedTotals(
  rows: readonly Pick<Harvest, 'quantity' | 'unit'>[]
): MixedHarvestTotals {
  const grams = sumWeightGrams(rows);
  const pieces = sumPieces(rows);
  return {
    weight: grams > 0 ? { grams } : null,
    pieces: pieces > 0 ? { pieces } : null,
  };
}

/** Formats a single stored harvest quantity with its unit label. */
export function formatHarvestQuantity(
  quantity: number,
  unit: HarvestUnit
): string {
  const amount = formatWeightAmount(quantity, unit);
  return `${amount} ${HARVEST_UNIT_LABELS[unit]}`;
}

/** Formats aggregated integer grams for display (kg or g). */
export function formatWeightFromGrams(grams: number): string {
  if (grams >= 1000) {
    const kg = grams / 1000;
    return `${trimTrailingZeros(formatDecimalForDisplay(kg))} ${HARVEST_UNIT_LABELS.kg}`;
  }
  return `${grams} ${HARVEST_UNIT_LABELS.g}`;
}

/** Formats aggregated piece count. */
export function formatPiecesTotal(pieces: number): string {
  const amount = trimTrailingZeros(formatDecimalForDisplay(pieces));
  return `${amount} ${HARVEST_UNIT_LABELS.pcs}`;
}

/**
 * Formats mixed totals as "12,4 кг · 8 шт" — never merges weight and pieces.
 */
export function formatMixedTotals(totals: MixedHarvestTotals): string | null {
  const parts: string[] = [];
  if (totals.weight) {
    parts.push(formatWeightFromGrams(totals.weight.grams));
  }
  if (totals.pieces) {
    parts.push(formatPiecesTotal(totals.pieces.pieces));
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}

/** Title line for auto-generated harvest diary events. */
export function formatHarvestEventTitle(
  quantity: number,
  unit: HarvestUnit
): string {
  return formatHarvestQuantity(quantity, unit);
}

/** Computes yield per plant when denominator is a plant count unit. */
export function computeYieldPerPlant(
  weightGrams: number,
  plantingQuantity: number | null,
  plantingQuantityUnit: QuantityUnit | null
): string | null {
  if (
    plantingQuantity === null ||
    plantingQuantity <= 0 ||
    !plantingQuantityUnit ||
    !(PLANT_COUNT_QUANTITY_UNITS as readonly string[]).includes(
      plantingQuantityUnit
    )
  ) {
    return null;
  }

  const gramsPerPlant = weightGrams / plantingQuantity;
  if (!Number.isFinite(gramsPerPlant) || gramsPerPlant <= 0) {
    return null;
  }

  const unitLabel =
    plantingQuantityUnit === 'bushes'
      ? 'куст'
      : plantingQuantityUnit === 'plants'
        ? 'раст.'
        : 'шт.';

  if (gramsPerPlant >= 1000) {
    const kg = gramsPerPlant / 1000;
    return `${trimTrailingZeros(formatDecimalForDisplay(roundToTwo(kg)))} ${HARVEST_UNIT_LABELS.kg}/${unitLabel}`;
  }

  return `${Math.round(gramsPerPlant)} ${HARVEST_UNIT_LABELS.g}/${unitLabel}`;
}

function formatWeightAmount(quantity: number, unit: HarvestUnit): string {
  if (unit === 'pcs') {
    return trimTrailingZeros(formatDecimalForDisplay(quantity));
  }
  return trimTrailingZeros(formatDecimalForDisplay(quantity));
}

function trimTrailingZeros(text: string): string {
  if (!text.includes(',')) {
    return text;
  }
  return text.replace(/,?0+$/, '').replace(/,$/, '');
}

function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Validates harvest unit string from storage. */
export function assertHarvestUnit(unit: string): asserts unit is HarvestUnit {
  if (!(HARVEST_UNITS as readonly string[]).includes(unit)) {
    throw new Error(`Invalid harvest unit: ${unit}`);
  }
}
