/**
 * Central monetization configuration — ad unit IDs, AppMetrica key, session policy.
 * Debug builds always use Yandex demo ad units; production IDs are placeholders
 * until configured in the Yandex Advertising Network / AppMetrica console.
 */

/** Minimum qualifying sessions before the first interstitial may appear. */
export const MIN_SESSIONS_BEFORE_FIRST_INTERSTITIAL = 6;

/** Qualifying sessions required between successive interstitials. */
export const SESSIONS_BETWEEN_INTERSTITIALS = 7;

/** Yandex official demo ad units — safe for local development and QA. */
export const YANDEX_DEMO_AD_UNITS = {
	banner: 'demo-banner-yandex',
	interstitial: 'demo-interstitial-yandex',
} as const;

/**
 * Production ad unit IDs from Yandex Advertising Network.
 * Replace empty strings with real block IDs before store release.
 */
export const PRODUCTION_AD_UNITS = {
	/** Banner on the Today tab. */
	bannerToday: '',
	/** Banner on the Statistics tab (may reuse Today block or use a separate one). */
	bannerStats: '',
	/** Full-screen interstitial block. */
	interstitial: '',
} as const;

/**
 * AppMetrica API key — public SDK identifier, not a secret.
 * Replace the empty string with the production key from AppMetrica console.
 */
export const APPMETRICA_PRODUCTION_API_KEY = '';

export type BannerPlacement = 'today' | 'stats';

/** True when release/production ad identifiers should be selected. */
export function isMonetizationProductionBuild(): boolean {
	return !__DEV__;
}

/** Resolves banner ad unit id for a screen placement. */
export function getBannerAdUnitId(placement: BannerPlacement): string {
	if (!isMonetizationProductionBuild()) {
		return YANDEX_DEMO_AD_UNITS.banner;
	}

	if (placement === 'today' && PRODUCTION_AD_UNITS.bannerToday) {
		return PRODUCTION_AD_UNITS.bannerToday;
	}
	if (placement === 'stats' && PRODUCTION_AD_UNITS.bannerStats) {
		return PRODUCTION_AD_UNITS.bannerStats;
	}

	// Fall back to Today block or demo when production ids are not configured yet.
	return PRODUCTION_AD_UNITS.bannerToday || YANDEX_DEMO_AD_UNITS.banner;
}

/** Resolves interstitial ad unit id for the current build flavor. */
export function getInterstitialAdUnitId(): string {
	if (!isMonetizationProductionBuild()) {
		return YANDEX_DEMO_AD_UNITS.interstitial;
	}
	return PRODUCTION_AD_UNITS.interstitial || YANDEX_DEMO_AD_UNITS.interstitial;
}

/** Resolves AppMetrica API key for the current build flavor. */
export function getAppMetricaApiKey(): string {
	if (!isMonetizationProductionBuild()) {
		// Demo key documented by AppMetrica for plugin smoke tests.
		return '00000000-0000-0000-0000-000000000000';
	}
	return APPMETRICA_PRODUCTION_API_KEY || '00000000-0000-0000-0000-000000000000';
}
