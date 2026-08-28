/**
 * Hook: garden + deterministic active season + areas + season plantings + catalog map.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import type {
  Garden,
  GardenArea,
  PlantCatalogItem,
  Planting,
  Season,
} from '@/src/domain/types';
import { useDatabase } from '@/src/providers/DatabaseProvider';

export type GardenSnapshot = {
  loading: boolean;
  garden: Garden | null;
  season: Season | null;
  areas: GardenArea[];
  plantings: Planting[];
  catalogItems: PlantCatalogItem[];
  catalogById: Map<string, PlantCatalogItem>;
  plantingsByAreaId: Map<string, Planting[]>;
  reload: () => void;
};

export function useGardenSnapshot(): GardenSnapshot {
  const {
    ready,
    refreshToken,
    gardenRepository,
    seasonRepository,
    areaRepository,
    plantingRepository,
    catalogRepository,
  } = useDatabase();

  const [loading, setLoading] = useState(true);
  const [garden, setGarden] = useState<Garden | null>(null);
  const [season, setSeason] = useState<Season | null>(null);
  const [areas, setAreas] = useState<GardenArea[]>([]);
  const [plantings, setPlantings] = useState<Planting[]>([]);
  const [catalogItems, setCatalogItems] = useState<PlantCatalogItem[]>([]);

  const reload = useCallback(() => {
    if (
      !ready ||
      !gardenRepository ||
      !seasonRepository ||
      !areaRepository ||
      !plantingRepository ||
      !catalogRepository
    ) {
      setLoading(true);
      return;
    }

    const primary = gardenRepository.getPrimary();
    setGarden(primary);

    if (!primary) {
      setSeason(null);
      setAreas([]);
      setPlantings([]);
      setCatalogItems([]);
      setLoading(false);
      return;
    }

    const activeSeason = seasonRepository.getActiveForGarden(primary.id);
    setSeason(activeSeason);
    setAreas(areaRepository.listByGarden(primary.id));
    setCatalogItems(catalogRepository.listByGarden(primary.id));
    setPlantings(
      activeSeason ? plantingRepository.listBySeason(activeSeason.id) : []
    );
    setLoading(false);
  }, [
    ready,
    gardenRepository,
    seasonRepository,
    areaRepository,
    plantingRepository,
    catalogRepository,
  ]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        reload();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [reload, refreshToken]);

  const catalogById = useMemo(
    () => new Map(catalogItems.map((item) => [item.id, item])),
    [catalogItems]
  );

  const plantingsByAreaId = useMemo(() => {
    const map = new Map<string, Planting[]>();
    for (const planting of plantings) {
      if (!planting.areaId) {
        continue;
      }
      const list = map.get(planting.areaId) ?? [];
      list.push(planting);
      map.set(planting.areaId, list);
    }
    return map;
  }, [plantings]);

  return {
    loading,
    garden,
    season,
    areas,
    plantings,
    catalogItems,
    catalogById,
    plantingsByAreaId,
    reload,
  };
}
