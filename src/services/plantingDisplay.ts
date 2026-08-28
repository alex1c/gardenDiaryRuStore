/**
 * Display helpers for plantings, catalog items, and area summaries.
 */

import {
  ACTIVE_PLANTING_STATUSES,
  QUANTITY_UNIT_LABELS,
  type PlantingStatus,
  type QuantityUnit,
} from '@/src/domain/codes';
import type { PlantCatalogItem, Planting } from '@/src/domain/types';
import { formatDecimalForDisplay } from '@/src/utils/numeric';

/** Returns true when the planting still counts as active on the plot. */
export function isActivePlantingStatus(status: PlantingStatus): boolean {
  return (ACTIVE_PLANTING_STATUSES as readonly string[]).includes(status);
}

/** Formats catalog species + optional variety for UI. */
export function formatCatalogLabel(item: PlantCatalogItem): string {
  if (item.varietyName) {
    return `${item.speciesName} · ${item.varietyName}`;
  }
  return item.speciesName;
}

/** Formats quantity with a Russian unit label, e.g. "24 кустов". */
export function formatQuantityWithUnit(
  quantity: number | null,
  unit: QuantityUnit | null
): string | null {
  if (quantity === null) {
    return null;
  }
  const amount = formatDecimalForDisplay(quantity);
  if (!unit) {
    return amount;
  }
  return `${amount} ${QUANTITY_UNIT_LABELS[unit]}`;
}

/** Formats optional area dimensions, e.g. "6,0 × 1,0 м". */
export function formatAreaDimensions(
  length: number | null,
  width: number | null
): string | null {
  if (length === null || width === null) {
    return null;
  }
  return `${formatDecimalForDisplay(length)} × ${formatDecimalForDisplay(width)} м`;
}

export type AreaPlantingSummary = {
  activeCount: number;
  cultureLabels: string[];
  subtitle: string;
};

/**
 * Builds a short subtitle for an area card on the plot screen.
 */
export function buildAreaCardSubtitle(
  plantings: Planting[],
  catalogById: Map<string, PlantCatalogItem>
): AreaPlantingSummary {
  const active = plantings.filter((p) => isActivePlantingStatus(p.status));

  if (active.length === 0) {
    return {
      activeCount: 0,
      cultureLabels: [],
      subtitle: 'Пока ничего не посажено',
    };
  }

  const cultureLabels = uniqueCultureLabels(active, catalogById);

  if (active.length === 1) {
    const planting = active[0];
    const catalog = catalogById.get(planting.catalogItemId);
    const culture = catalog ? formatCatalogLabel(catalog) : 'Посадка';
    const qty = formatQuantityWithUnit(planting.quantity, planting.quantityUnit);
    return {
      activeCount: 1,
      cultureLabels,
      subtitle: qty ? `${culture} · ${qty}` : culture,
    };
  }

  if (cultureLabels.length >= 2 && cultureLabels.length <= 3) {
    return {
      activeCount: active.length,
      cultureLabels,
      subtitle: cultureLabels.join(' · '),
    };
  }

  return {
    activeCount: active.length,
    cultureLabels,
    subtitle: formatPlantingCount(active.length),
  };
}

function formatPlantingCount(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) {
    return `${count} посадка`;
  }
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
    return `${count} посадки`;
  }
  return `${count} посадок`;
}

function uniqueCultureLabels(
  plantings: Planting[],
  catalogById: Map<string, PlantCatalogItem>
): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];

  for (const planting of plantings) {
    const catalog = catalogById.get(planting.catalogItemId);
    if (!catalog) {
      continue;
    }
    const label = catalog.varietyName
      ? catalog.speciesName
      : formatCatalogLabel(catalog);
    if (!seen.has(label)) {
      seen.add(label);
      labels.push(label);
    }
  }

  return labels;
}

/** Default status for a newly added planting without explicit dates. */
export function defaultPlantingStatus(): PlantingStatus {
  return 'growing';
}
