/**
 * Active vs viewed season context for the app.
 *
 * - activeSeason: working season (Today, new records)
 * - viewedSeason: browse context (Stats, Diary, Plot) — may be an archive
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type { Season } from '@/src/domain/types';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import {
  resolveActiveSeason,
  setActiveSeason as persistActiveSeason,
} from '@/src/services/seasonContextService';

export type SeasonContextValue = {
  loading: boolean;
  activeSeason: Season | null;
  viewedSeason: Season | null;
  /** True when user browses a season other than the active working season. */
  isViewingArchive: boolean;
  setViewedSeasonId: (seasonId: string | null) => void;
  setActiveSeasonId: (seasonId: string) => void;
  resetViewedSeason: () => void;
  reload: () => void;
};

const SeasonContext = createContext<SeasonContextValue | null>(null);

type Props = {
  children: ReactNode;
};

export function SeasonProvider({ children }: Props) {
  const {
    ready,
    db,
    refreshToken,
    gardenRepository,
    seasonRepository,
    bumpRefresh,
  } = useDatabase();

  const [loading, setLoading] = useState(true);
  const [activeSeason, setActiveSeasonState] = useState<Season | null>(null);
  const [viewedSeasonId, setViewedSeasonIdState] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!ready || !db || !gardenRepository || !seasonRepository) {
      setLoading(true);
      return;
    }

    const garden = gardenRepository.getPrimary();
    if (!garden) {
      setActiveSeasonState(null);
      setViewedSeasonIdState(null);
      setLoading(false);
      return;
    }

    const active = resolveActiveSeason(db, garden.id);
    setActiveSeasonState(active);

    if (viewedSeasonId) {
      const viewed = seasonRepository.getById(viewedSeasonId);
      if (!viewed || viewed.gardenId !== garden.id) {
        setViewedSeasonIdState(null);
      }
    }

    setLoading(false);
  }, [ready, db, gardenRepository, seasonRepository, viewedSeasonId]);

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

  const viewedSeason = useMemo(() => {
    if (!seasonRepository) {
      return activeSeason;
    }
    if (!viewedSeasonId) {
      return activeSeason;
    }
    const season = seasonRepository.getById(viewedSeasonId);
    return season ?? activeSeason;
  }, [seasonRepository, viewedSeasonId, activeSeason]);

  const isViewingArchive = Boolean(
    activeSeason && viewedSeason && activeSeason.id !== viewedSeason.id
  );

  const setViewedSeasonId = useCallback((seasonId: string | null) => {
    setViewedSeasonIdState(seasonId);
  }, []);

  const resetViewedSeason = useCallback(() => {
    setViewedSeasonIdState(null);
  }, []);

  const setActiveSeasonId = useCallback(
    (seasonId: string) => {
      if (!db || !gardenRepository) {
        return;
      }
      const garden = gardenRepository.getPrimary();
      if (!garden) {
        return;
      }
      const season = persistActiveSeason(db, garden.id, seasonId);
      setActiveSeasonState(season);
      setViewedSeasonIdState(null);
      bumpRefresh();
    },
    [db, gardenRepository, bumpRefresh]
  );

  const value = useMemo<SeasonContextValue>(
    () => ({
      loading,
      activeSeason,
      viewedSeason,
      isViewingArchive,
      setViewedSeasonId,
      setActiveSeasonId,
      resetViewedSeason,
      reload,
    }),
    [
      loading,
      activeSeason,
      viewedSeason,
      isViewingArchive,
      setViewedSeasonId,
      setActiveSeasonId,
      resetViewedSeason,
      reload,
    ]
  );

  return (
    <SeasonContext.Provider value={value}>{children}</SeasonContext.Provider>
  );
}

export function useSeasonContext(): SeasonContextValue {
  const ctx = useContext(SeasonContext);
  if (!ctx) {
    throw new Error('useSeasonContext must be used within SeasonProvider');
  }
  return ctx;
}
