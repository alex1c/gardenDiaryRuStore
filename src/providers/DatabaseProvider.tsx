/**
 * Provides the opened SqlDatabase and repository instances to the React tree.
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

import { openAppDatabase } from '@/src/db/database';
import type { SqlDatabase } from '@/src/db/types';
import { formatErrorForDiagnostics } from '@/src/domain/errors';
import { GardenAreaRepository } from '@/src/repositories/GardenAreaRepository';
import { GardenRepository } from '@/src/repositories/GardenRepository';
import { PlantCatalogRepository } from '@/src/repositories/PlantCatalogRepository';
import { PlantingRepository } from '@/src/repositories/PlantingRepository';
import { SeasonRepository } from '@/src/repositories/SeasonRepository';
import { SettingsRepository } from '@/src/repositories/SettingsRepository';

export type DatabaseContextValue = {
  ready: boolean;
  error: string | null;
  db: SqlDatabase | null;
  /** Incremented after mutations so screens can reload. */
  refreshToken: number;
  bumpRefresh: () => void;
  gardenRepository: GardenRepository | null;
  seasonRepository: SeasonRepository | null;
  areaRepository: GardenAreaRepository | null;
  catalogRepository: PlantCatalogRepository | null;
  plantingRepository: PlantingRepository | null;
  settingsRepository: SettingsRepository | null;
};

const DatabaseContext = createContext<DatabaseContextValue | null>(null);

type Props = {
  children: ReactNode;
};

/**
 * Opens the local SQLite database on mount and shares repositories via context.
 */
export function DatabaseProvider({ children }: Props) {
  const [db, setDb] = useState<SqlDatabase | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const bumpRefresh = useCallback(() => {
    setRefreshToken((n) => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) {
        return;
      }

      try {
        const opened = openAppDatabase();
        if (!cancelled) {
          setDb(opened);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(formatErrorForDiagnostics(err));
          setDb(null);
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<DatabaseContextValue>(() => {
    if (!db) {
      return {
        ready: false,
        error,
        db: null,
        refreshToken,
        bumpRefresh,
        gardenRepository: null,
        seasonRepository: null,
        areaRepository: null,
        catalogRepository: null,
        plantingRepository: null,
        settingsRepository: null,
      };
    }

    return {
      ready: true,
      error: null,
      db,
      refreshToken,
      bumpRefresh,
      gardenRepository: new GardenRepository(db),
      seasonRepository: new SeasonRepository(db),
      areaRepository: new GardenAreaRepository(db),
      catalogRepository: new PlantCatalogRepository(db),
      plantingRepository: new PlantingRepository(db),
      settingsRepository: new SettingsRepository(db),
    };
  }, [db, error, refreshToken, bumpRefresh]);

  return (
    <DatabaseContext.Provider value={value}>{children}</DatabaseContext.Provider>
  );
}

export function useDatabase(): DatabaseContextValue {
  const ctx = useContext(DatabaseContext);
  if (!ctx) {
    throw new Error('useDatabase must be used within DatabaseProvider');
  }
  return ctx;
}
