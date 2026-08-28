/**
 * Hook: app settings with reload on refresh token.
 */

import { useCallback, useEffect, useState } from 'react';

import {
  DEFAULT_APP_SETTINGS,
  type AppSettings,
} from '@/src/domain/types';
import { useDatabase } from '@/src/providers/DatabaseProvider';

export function useAppSettings(): {
  loading: boolean;
  settings: AppSettings;
  reload: () => void;
  patchSettings: (partial: Partial<AppSettings>) => AppSettings;
} {
  const { ready, refreshToken, settingsRepository } = useDatabase();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);

  const reload = useCallback(() => {
    if (!ready || !settingsRepository) {
      setLoading(true);
      return;
    }
    setSettings(settingsRepository.getSettings());
    setLoading(false);
  }, [ready, settingsRepository]);

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

  const patchSettings = useCallback(
    (partial: Partial<AppSettings>) => {
      if (!settingsRepository) {
        return settings;
      }
      const next = settingsRepository.patch(partial);
      setSettings(next);
      return next;
    },
    [settingsRepository, settings]
  );

  return { loading, settings, reload, patchSettings };
}
