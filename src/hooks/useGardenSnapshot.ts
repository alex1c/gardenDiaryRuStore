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
import { useSeasonContext } from '@/src/providers/SeasonProvider';
import { useDatabase } from '@/src/providers/DatabaseProvider';

export type GardenSnapshot = {
  loading: boolean;
  garden: Garden | null;
  /** Season shown in browse screens (Stats, Diary, Plot). */
  season: Season | null;
  /** Working active season (Today, new records). */
  activeSeason: Season | null;
  isViewingArchive: boolean;
  areas: GardenArea[];
  plantings: Planting[];
  /** Plantings for the active working season (Today screen). */
  activePlantings: Planting[];
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
    areaRepository,
    plantingRepository,
    catalogRepository,
  } = useDatabase();
  const {
    loading: seasonLoading,
    viewedSeason,
    activeSeason,
    isViewingArchive,
  } = useSeasonContext();

  const [loading, setLoading] = useState(true);
  const [garden, setGarden] = useState<Garden | null>(null);
  const [season, setSeason] = useState<Season | null>(null);
  const [areas, setAreas] = useState<GardenArea[]>([]);
  const [plantings, setPlantings] = useState<Planting[]>([]);
  const [activePlantings, setActivePlantings] = useState<Planting[]>([]);
  const [catalogItems, setCatalogItems] = useState<PlantCatalogItem[]>([]);

  const reload = useCallback(() => {
    if (
      !ready ||
      !gardenRepository ||
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
      setActivePlantings([]);
      setCatalogItems([]);
      setLoading(false);
      return;
    }

    setSeason(viewedSeason);
    setAreas(areaRepository.listByGarden(primary.id));
    setCatalogItems(catalogRepository.listByGarden(primary.id));
    setPlantings(
      viewedSeason ? plantingRepository.listBySeason(viewedSeason.id) : []
    );
    setActivePlantings(
      activeSeason ? plantingRepository.listBySeason(activeSeason.id) : []
    );
    setLoading(false);
  }, [
    ready,
    gardenRepository,
    areaRepository,
    plantingRepository,
    catalogRepository,
    viewedSeason,
    activeSeason,
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
    loading: loading || seasonLoading,
    garden,
    season,
    activeSeason,
    isViewingArchive,
    areas,
    plantings,
    activePlantings,
    catalogItems,
    catalogById,
    plantingsByAreaId,
    reload,
  };
}
