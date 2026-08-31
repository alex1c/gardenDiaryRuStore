/**
 * Optional Yandex Mobile Ads native bridge.
 * Returns null when the native module is unavailable (web, tests, Expo Go).
 */

import { Platform } from 'react-native';

import { getInterstitialAdUnitId } from '@/src/constants/monetization';

type YandexAdsModule = typeof import('yandex-mobile-ads');

let cachedModule: YandexAdsModule | null | undefined;

/** Lazily loads the Yandex ads SDK on supported native platforms. */
export function getYandexAdsModule(): YandexAdsModule | null {
	if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
		return null;
	}

	if (cachedModule !== undefined) {
		return cachedModule;
	}

	try {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		cachedModule = require('yandex-mobile-ads') as YandexAdsModule;
	} catch {
		cachedModule = null;
	}

	return cachedModule;
}

/** Initializes Yandex Mobile Ads — best-effort, never throws. */
export async function initializeYandexAds(): Promise<void> {
	const mod = getYandexAdsModule();
	if (!mod) {
		return;
	}

	try {
		await mod.MobileAds.initialize();
	} catch {
		// Native SDK unavailable or misconfigured — ads stay disabled.
	}
}

export type InterstitialNativeBridge = {
	isReady: () => boolean;
	show: () => Promise<boolean>;
	preload: () => Promise<void>;
};

/** Creates a preload/show bridge backed by Yandex InterstitialAdLoader. */
export function createYandexInterstitialBridge(): InterstitialNativeBridge {
	let ready = false;
	let loading = false;
	let currentAd: import('yandex-mobile-ads').InterstitialAd | null = null;
	let loader: import('yandex-mobile-ads').InterstitialAdLoader | null = null;

	const adUnitId = getInterstitialAdUnitId();

	const preload = async (): Promise<void> => {
		if (!adUnitId) {
			return;
		}
		const mod = getYandexAdsModule();
		if (!mod || loading || ready) {
			return;
		}

		loading = true;
		try {
			loader = await mod.InterstitialAdLoader.create();
			const ad = await loader.loadAd({ adUnitId });
			currentAd = ad;
			ready = true;
		} catch {
			ready = false;
			currentAd = null;
		} finally {
			loading = false;
		}
	};

	return {
		isReady: () => ready,
		preload,
		show: async () => {
			if (!ready || !currentAd) {
				return false;
			}

			try {
				await currentAd.show();
				ready = false;
				currentAd = null;
				void preload();
				return true;
			} catch {
				ready = false;
				currentAd = null;
				void preload();
				return false;
			}
		},
	};
}

/** Resets module cache — test helper. */
export function resetYandexAdsModuleCache(): void {
	cachedModule = undefined;
}
