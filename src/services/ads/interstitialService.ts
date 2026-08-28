/**
 * Central interstitial ad service — preload, eligibility, show, persisted state.
 * UI must call tryShowInterstitialAtSafePoint instead of invoking SDK directly.
 */

import type { SettingsRepository } from '@/src/repositories/SettingsRepository';

import {
	isInterstitialEligible,
	recordInterstitialShown,
} from './adPolicy';
import {
	consumePendingSafeTrigger,
	hasShownInterstitialThisSession,
	markInterstitialShownThisSession,
} from './adSession';
import {
	createYandexInterstitialBridge,
	type InterstitialNativeBridge,
} from './yandexAdsAdapter';

let bridge: InterstitialNativeBridge = createYandexInterstitialBridge();

/** Injects a test double for the native interstitial bridge. */
export function setInterstitialBridgeForTests(
	next: InterstitialNativeBridge
): void {
	bridge = next;
}

/** Restores the default Yandex-backed bridge after tests. */
export function resetInterstitialBridgeForTests(): void {
	bridge = createYandexInterstitialBridge();
}

/** Starts background preload — safe to call multiple times. */
export function preloadInterstitial(): void {
	void bridge.preload().catch(() => undefined);
}

/** Whether a loaded interstitial is ready to display. */
export function isInterstitialReady(): boolean {
	return bridge.isReady();
}

/**
 * Attempts to show an interstitial when policy and UI preconditions are met.
 * Returns true when the ad was actually shown.
 */
export async function tryShowInterstitialAtSafePoint(
	settingsRepository: SettingsRepository,
	hasPendingSafeTrigger: boolean
): Promise<boolean> {
	const settings = settingsRepository.getSettings();
	const eligible = isInterstitialEligible({
		qualifyingSessionCount: settings.qualifyingSessionCount,
		lastInterstitialSession: settings.lastInterstitialSession,
		shownThisSession: hasShownInterstitialThisSession(),
		hasPendingSafeTrigger,
		adReady: bridge.isReady(),
	});

	if (!eligible) {
		return false;
	}

	if (!consumePendingSafeTrigger()) {
		return false;
	}

	const shown = await bridge.show();
	if (!shown) {
		return false;
	}

	markInterstitialShownThisSession();
	const next = recordInterstitialShown(
		{
			qualifyingSessionCount: settings.qualifyingSessionCount,
			lastInterstitialSession: settings.lastInterstitialSession,
		},
		settings.qualifyingSessionCount
	);
	settingsRepository.patch({
		lastInterstitialSession: next.lastInterstitialSession,
	});

	return true;
}

/** Increments qualifying session counter once per foreground stint. */
export function registerQualifyingSession(
	settingsRepository: SettingsRepository
): number {
	const settings = settingsRepository.getSettings();
	const nextCount = settings.qualifyingSessionCount + 1;
	settingsRepository.patch({ qualifyingSessionCount: nextCount });
	return nextCount;
}
