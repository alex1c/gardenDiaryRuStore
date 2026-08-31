/**
 * Central monetization configuration — ad unit IDs, AppMetrica key, session policy.
 * Debug builds always use Yandex demo ad units; production IDs below are for release.
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

/** Production ad unit IDs from Yandex Advertising Network (v1 release). */
export const PRODUCTION_AD_UNITS = {
	/** Banner on the Today tab — shared v1 block. */
	bannerToday: 'R-M-19846495-1',
	/** Banner on the Statistics tab — same block as Today in v1. */
	bannerStats: 'R-M-19846495-1',
	/** Full-screen interstitial block. */
	interstitial: 'R-M-19846495-2',
} as const;

/**
 * AppMetrica API key — public SDK identifier, not a secret.
 * Configured for RuStore production release.
 */
export const APPMETRICA_PRODUCTION_API_KEY =
	'0dc64afa-6bda-4b04-824c-bf253829ebe6';

export type BannerPlacement = 'today' | 'stats';

/** True when release/production ad identifiers should be selected. */
export function isMonetizationProductionBuild(): boolean {
	return !__DEV__;
}

/** Resolves banner ad unit id for a screen placement. */
export function getBannerAdUnitId(
	placement: BannerPlacement,
	production = isMonetizationProductionBuild()
): string {
	if (!production) {
		return YANDEX_DEMO_AD_UNITS.banner;
	}

	if (placement === 'today' && PRODUCTION_AD_UNITS.bannerToday) {
		return PRODUCTION_AD_UNITS.bannerToday;
	}
	if (placement === 'stats' && PRODUCTION_AD_UNITS.bannerStats) {
		return PRODUCTION_AD_UNITS.bannerStats;
	}

	// Never send production traffic to a demo unit. An empty id disables the slot.
	return '';
}

/** Resolves interstitial ad unit id for the current build flavor. */
export function getInterstitialAdUnitId(
	production = isMonetizationProductionBuild()
): string {
	if (!production) {
		return YANDEX_DEMO_AD_UNITS.interstitial;
	}
	// Never send production traffic to a demo unit. An empty id disables preload.
	return PRODUCTION_AD_UNITS.interstitial;
}

/** Resolves AppMetrica API key for the current build flavor. */
export function getAppMetricaApiKey(
	production = isMonetizationProductionBuild()
): string {
	if (!production) {
		// Demo key documented by AppMetrica for plugin smoke tests.
		return '00000000-0000-0000-0000-000000000000';
	}
	// An empty key disables AppMetrica in release builds.
	return APPMETRICA_PRODUCTION_API_KEY;
}

/** Whether production monetization identifiers are fully configured. */
export function isProductionMonetizationConfigured(): boolean {
	return (
		Boolean(PRODUCTION_AD_UNITS.bannerToday) &&
		Boolean(PRODUCTION_AD_UNITS.bannerStats) &&
		Boolean(PRODUCTION_AD_UNITS.interstitial) &&
		Boolean(APPMETRICA_PRODUCTION_API_KEY)
	);
}

/** Returns production ad/metrica ids — test helper for release validation. */
export function getProductionMonetizationSnapshot(): {
	appMetricaApiKey: string;
	bannerToday: string;
	bannerStats: string;
	interstitial: string;
} {
	return {
		appMetricaApiKey: getAppMetricaApiKey(true),
		bannerToday: getBannerAdUnitId('today', true),
		bannerStats: getBannerAdUnitId('stats', true),
		interstitial: getInterstitialAdUnitId(true),
	};
}
