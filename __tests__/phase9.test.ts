/**
 * Phase 9 — analytics wrapper, ad policy, config, backup ad settings.
 */

import {
	DEFAULT_AD_POLICY_CONFIG,
	isInterstitialEligible,
	recordInterstitialShown,
} from '@/src/services/ads/adPolicy';
import {
	consumePendingSafeTrigger,
	hasShownInterstitialThisSession,
	markMeaningfulActionCompleted,
	resetAdSessionRuntime,
} from '@/src/services/ads/adSession';
import {
	preloadInterstitial,
	registerQualifyingSession,
	resetInterstitialBridgeForTests,
	setInterstitialBridgeForTests,
	tryShowInterstitialAtSafePoint,
} from '@/src/services/ads/interstitialService';
import {
	NON_PORTABLE_AD_SETTING_KEYS,
	normalizeAppSettingsRowsForRestore,
} from '@/src/services/backup/adSettingsNormalization';
import {
	resetAnalyticsReporterForTests,
	sanitizeAnalyticsProps,
	setAnalyticsReporterForTests,
	trackAnalyticsEvent,
} from '@/src/services/analytics/analytics';
import { ANALYTICS_EVENTS } from '@/src/services/analytics/events';
import {
	getAppMetricaApiKey,
	getBannerAdUnitId,
	getInterstitialAdUnitId,
	isMonetizationProductionBuild,
} from '@/src/constants/monetization';
import initSqlJs from 'sql.js';

import { createDatabaseFromClient } from '@/src/db/database';
import { runMigrations } from '@/src/db/migrate';
import { createSqlJsAdapter } from '@/src/db/sqlJsAdapter';
import type { SqlDatabase } from '@/src/db/types';

import { SettingsRepository } from '@/src/repositories/SettingsRepository';

async function openTestDb(): Promise<SqlDatabase> {
	const SQL = await initSqlJs();
	const raw = new SQL.Database();
	const db = createDatabaseFromClient(createSqlJsAdapter(raw));
	runMigrations(db);
	return db;
}

describe('Phase 9 — ad policy', () => {
	it('blocks interstitial before minimum qualifying sessions', () => {
		expect(
			isInterstitialEligible({
				qualifyingSessionCount: 5,
				lastInterstitialSession: 0,
				shownThisSession: false,
				hasPendingSafeTrigger: true,
				adReady: true,
			})
		).toBe(false);
	});

	it('becomes eligible at the configured first-session threshold', () => {
		expect(
			isInterstitialEligible({
				qualifyingSessionCount: 6,
				lastInterstitialSession: 0,
				shownThisSession: false,
				hasPendingSafeTrigger: true,
				adReady: true,
			})
		).toBe(true);
	});

	it('enforces spacing between interstitials', () => {
		expect(
			isInterstitialEligible({
				qualifyingSessionCount: 12,
				lastInterstitialSession: 6,
				shownThisSession: false,
				hasPendingSafeTrigger: true,
				adReady: true,
			})
		).toBe(false);

		expect(
			isInterstitialEligible({
				qualifyingSessionCount: 13,
				lastInterstitialSession: 6,
				shownThisSession: false,
				hasPendingSafeTrigger: true,
				adReady: true,
			})
		).toBe(true);
	});

	it('allows at most one interstitial per foreground session', () => {
		expect(
			isInterstitialEligible({
				qualifyingSessionCount: 20,
				lastInterstitialSession: 13,
				shownThisSession: true,
				hasPendingSafeTrigger: true,
				adReady: true,
			})
		).toBe(false);
	});

	it('skips when ad is not ready', () => {
		expect(
			isInterstitialEligible({
				qualifyingSessionCount: 10,
				lastInterstitialSession: 0,
				shownThisSession: false,
				hasPendingSafeTrigger: true,
				adReady: false,
			})
		).toBe(false);
	});

	it('records last interstitial session on successful show', () => {
		expect(
			recordInterstitialShown(
				{ qualifyingSessionCount: 13, lastInterstitialSession: 6 },
				13
			)
		).toEqual({
			qualifyingSessionCount: 13,
			lastInterstitialSession: 13,
		});
	});
});

describe('Phase 9 — interstitial service integration', () => {
	beforeEach(() => {
		resetAdSessionRuntime();
		resetInterstitialBridgeForTests();
	});

	it('does not block when native show fails', async () => {
		const db = await openTestDb();
		const settingsRepository = new SettingsRepository(db);
		settingsRepository.patch({
			qualifyingSessionCount: 6,
			lastInterstitialSession: 0,
		});

		setInterstitialBridgeForTests({
			isReady: () => true,
			preload: async () => undefined,
			show: async () => false,
		});

		markMeaningfulActionCompleted();
		const shown = await tryShowInterstitialAtSafePoint(
			settingsRepository,
			true
		);
		expect(shown).toBe(false);
		expect(hasShownInterstitialThisSession()).toBe(false);
		expect(settingsRepository.getSettings().lastInterstitialSession).toBe(0);
	});

	it('updates persisted state after successful show', async () => {
		const db = await openTestDb();
		const settingsRepository = new SettingsRepository(db);
		settingsRepository.patch({
			qualifyingSessionCount: 6,
			lastInterstitialSession: 0,
		});

		setInterstitialBridgeForTests({
			isReady: () => true,
			preload: async () => undefined,
			show: async () => true,
		});

		markMeaningfulActionCompleted();
		const shown = await tryShowInterstitialAtSafePoint(
			settingsRepository,
			true
		);
		expect(shown).toBe(true);
		expect(hasShownInterstitialThisSession()).toBe(true);
		expect(settingsRepository.getSettings().lastInterstitialSession).toBe(6);
		expect(consumePendingSafeTrigger()).toBe(false);
	});

	it('increments qualifying sessions once per register call', async () => {
		const db = await openTestDb();
		const settingsRepository = new SettingsRepository(db);
		expect(registerQualifyingSession(settingsRepository)).toBe(1);
		expect(registerQualifyingSession(settingsRepository)).toBe(2);
	});

	it('preloads without throwing when bridge preload fails', () => {
		setInterstitialBridgeForTests({
			isReady: () => false,
			preload: async () => {
				throw new Error('load failed');
			},
			show: async () => false,
		});
		expect(() => preloadInterstitial()).not.toThrow();
	});
});

describe('Phase 9 — analytics wrapper', () => {
	afterEach(() => {
		resetAnalyticsReporterForTests();
	});

	it('maps semantic events to the reporter', () => {
		const events: { name: string; props?: Record<string, unknown> }[] = [];
		setAnalyticsReporterForTests({
			reportEvent: (name, props) => {
				events.push({ name, props });
			},
		});

		trackAnalyticsEvent(ANALYTICS_EVENTS.TASK_CREATED, {
			task_type: 'watering',
			repeat_type: 'weekly',
		});

		expect(events).toEqual([
			{
				name: 'task_created',
				props: { task_type: 'watering', repeat_type: 'weekly' },
			},
		]);
	});

	it('strips unknown properties and user-like strings', () => {
		const sanitized = sanitizeAnalyticsProps({
			task_type: 'watering',
			area_type: 'My secret greenhouse name',
		} as never);

		expect(sanitized).toEqual({ task_type: 'watering' });
	});

	it('swallows reporter failures safely', () => {
		setAnalyticsReporterForTests({
			reportEvent: () => {
				throw new Error('sdk down');
			},
		});
		expect(() =>
			trackAnalyticsEvent(ANALYTICS_EVENTS.APP_OPEN)
		).not.toThrow();
	});
});

describe('Phase 9 — monetization config', () => {
	it('uses demo ad units in debug builds', () => {
		expect(__DEV__ ? getBannerAdUnitId('today') : '').toBeTruthy();
		if (__DEV__) {
			expect(getBannerAdUnitId('today')).toBe('demo-banner-yandex');
			expect(getInterstitialAdUnitId()).toBe('demo-interstitial-yandex');
			expect(isMonetizationProductionBuild()).toBe(false);
		}
	});

	it('exposes production config accessors', () => {
		expect(typeof getAppMetricaApiKey()).toBe('string');
		expect(typeof getInterstitialAdUnitId()).toBe('string');
	});

	it('does not substitute demo identifiers in production', () => {
		expect(getBannerAdUnitId('today', true)).toBe('');
		expect(getBannerAdUnitId('stats', true)).toBe('');
		expect(getInterstitialAdUnitId(true)).toBe('');
		expect(getAppMetricaApiKey(true)).toBe('');
	});
});

describe('Phase 9 — backup ad settings normalization', () => {
	it('resets non-portable ad counters on restore', () => {
		const rows = normalizeAppSettingsRowsForRestore([
			{ key: 'activeSeasonId', value: 'season-1', updated_at: 't' },
			{ key: 'qualifyingSessionCount', value: '42', updated_at: 't' },
			{ key: 'lastInterstitialSession', value: '30', updated_at: 't' },
		]);

		expect(NON_PORTABLE_AD_SETTING_KEYS.has('qualifyingSessionCount')).toBe(
			true
		);
		expect(rows.find((row) => row.key === 'activeSeasonId')?.value).toBe(
			'season-1'
		);
		expect(
			rows.find((row) => row.key === 'qualifyingSessionCount')?.value
		).toBe('0');
		expect(
			rows.find((row) => row.key === 'lastInterstitialSession')?.value
		).toBe('0');
	});
});

describe('Phase 9 — policy constants', () => {
	it('uses conservative 6 / 7 session thresholds', () => {
		expect(DEFAULT_AD_POLICY_CONFIG.minSessionsBeforeFirstInterstitial).toBe(
			6
		);
		expect(DEFAULT_AD_POLICY_CONFIG.sessionsBetweenInterstitials).toBe(7);
	});
});
