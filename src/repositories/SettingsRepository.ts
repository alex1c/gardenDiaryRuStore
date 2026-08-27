/**
 * Key-value settings repository backed by the app_settings table.
 */

import type { SqlDatabase } from '@/src/db/types';
import { StorageError } from '@/src/domain/errors';
import {
  DEFAULT_APP_SETTINGS,
  type AppSettings,
  type ThemePreference,
} from '@/src/domain/types';
import { nowIsoUtc } from '@/src/utils/timestamps';

type SettingsRow = {
  key: string;
  value: string;
  updated_at: string;
};

const KEYS = {
  settingsVersion: 'settingsVersion',
  onboardingCompleted: 'onboardingCompleted',
  notificationsEnabled: 'notificationsEnabled',
  themePreference: 'themePreference',
  activeGardenId: 'activeGardenId',
  activeSeasonId: 'activeSeasonId',
} as const;

export class SettingsRepository {
  constructor(private readonly db: SqlDatabase) {}

  getSettings(): AppSettings {
    try {
      const rows = this.db.getAll<SettingsRow>(
        'SELECT key, value, updated_at FROM app_settings'
      );
      const map = new Map(rows.map((r) => [r.key, r.value]));

      return {
        settingsVersion: readNumber(
          map.get(KEYS.settingsVersion),
          DEFAULT_APP_SETTINGS.settingsVersion
        ),
        onboardingCompleted: readBoolean(
          map.get(KEYS.onboardingCompleted),
          DEFAULT_APP_SETTINGS.onboardingCompleted
        ),
        notificationsEnabled: readBoolean(
          map.get(KEYS.notificationsEnabled),
          DEFAULT_APP_SETTINGS.notificationsEnabled
        ),
        themePreference: readTheme(
          map.get(KEYS.themePreference),
          DEFAULT_APP_SETTINGS.themePreference
        ),
        activeGardenId: readNullableString(
          map.get(KEYS.activeGardenId),
          DEFAULT_APP_SETTINGS.activeGardenId
        ),
        activeSeasonId: readNullableString(
          map.get(KEYS.activeSeasonId),
          DEFAULT_APP_SETTINGS.activeSeasonId
        ),
      };
    } catch (err) {
      throw new StorageError('Failed to load app settings', err);
    }
  }

  /**
   * Persists settings rows. Does not open its own transaction so callers
   * (e.g. bootstrapGardenWithSeason) can wrap create + settings atomically.
   */
  saveSettings(settings: AppSettings): void {
    const now = nowIsoUtc();

    try {
      this.upsert(KEYS.settingsVersion, String(settings.settingsVersion), now);
      this.upsert(
        KEYS.onboardingCompleted,
        settings.onboardingCompleted ? '1' : '0',
        now
      );
      this.upsert(
        KEYS.notificationsEnabled,
        settings.notificationsEnabled ? '1' : '0',
        now
      );
      this.upsert(KEYS.themePreference, settings.themePreference, now);
      this.upsert(KEYS.activeGardenId, settings.activeGardenId ?? '', now);
      this.upsert(KEYS.activeSeasonId, settings.activeSeasonId ?? '', now);
    } catch (err) {
      if (err instanceof StorageError) throw err;
      throw new StorageError('Failed to save app settings', err);
    }
  }

  /** Partial update helper used by first-run bootstrap. */
  patch(partial: Partial<AppSettings>): AppSettings {
    const current = this.getSettings();
    const next = { ...current, ...partial };
    this.saveSettings(next);
    return next;
  }

  private upsert(key: string, value: string, updatedAt: string): void {
    this.db.run(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
         value = excluded.value,
         updated_at = excluded.updated_at`,
      [key, value, updatedAt]
    );
  }
}

function readNumber(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function readBoolean(raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined) return fallback;
  if (raw === '1' || raw === 'true') return true;
  if (raw === '0' || raw === 'false') return false;
  return fallback;
}

function readTheme(
  raw: string | undefined,
  fallback: ThemePreference
): ThemePreference {
  if (raw === 'system' || raw === 'light' || raw === 'dark') {
    return raw;
  }
  return fallback;
}

function readNullableString(
  raw: string | undefined,
  fallback: string | null
): string | null {
  if (raw === undefined) return fallback;
  if (raw === '') return null;
  return raw;
}
