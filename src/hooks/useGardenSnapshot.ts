/**
 * Hook: load primary garden + active season + areas, refresh on token change.
 */

import { useCallback, useEffect, useState } from 'react';

import { useDatabase } from '@/src/providers/DatabaseProvider';
import type { Garden, GardenArea, Season } from '@/src/domain/types';

export type GardenSnapshot = {
  loading: boolean;
  garden: Garden | null;
  season: Season | null;
  areas: GardenArea[];
  reload: () => void;
};

export function useGardenSnapshot(): GardenSnapshot {
  const {
    ready,
    refreshToken,
    gardenRepository,
    seasonRepository,
    areaRepository,
  } = useDatabase();

  const [loading, setLoading] = useState(true);
  const [garden, setGarden] = useState<Garden | null>(null);
  const [season, setSeason] = useState<Season | null>(null);
  const [areas, setAreas] = useState<GardenArea[]>([]);

  const reload = useCallback(() => {
    if (!ready || !gardenRepository || !seasonRepository || !areaRepository) {
      setLoading(true);
      return;
    }

    const primary = gardenRepository.getPrimary();
    setGarden(primary);

    if (!primary) {
      setSeason(null);
      setAreas([]);
      setLoading(false);
      return;
    }

    const active = seasonRepository.getActiveForGarden(primary.id);
    setSeason(active);
    setAreas(areaRepository.listByGarden(primary.id));
    setLoading(false);
  }, [ready, gardenRepository, seasonRepository, areaRepository]);

  useEffect(() => {
    // Defer so we do not sync-setState in the same effect turn
    // (react-hooks/set-state-in-effect).
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

  return { loading, garden, season, areas, reload };
}
