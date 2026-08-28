/**
 * Optional AppMetrica native bridge — null when module unavailable.
 */

import { Platform } from 'react-native';

import { getAppMetricaApiKey } from '@/src/constants/monetization';

type AppMetricaModule = typeof import('@appmetrica/react-native-analytics').default;

let cachedModule: AppMetricaModule | null | undefined;
let activated = false;

/** Lazily loads AppMetrica on supported native platforms. */
export function getAppMetricaModule(): AppMetricaModule | null {
	if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
		return null;
	}

	if (cachedModule !== undefined) {
		return cachedModule;
	}

	try {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const loaded = require('@appmetrica/react-native-analytics')
			.default as AppMetricaModule;
		cachedModule = loaded;
	} catch {
		cachedModule = null;
	}

	return cachedModule;
}

/** Activates AppMetrica once — non-blocking, never throws. */
export function initializeAppMetrica(): void {
	if (activated) {
		return;
	}

	const mod = getAppMetricaModule();
	if (!mod) {
		return;
	}

	try {
		mod.activate({
			apiKey: getAppMetricaApiKey(),
			sessionTimeout: 300,
			logs: __DEV__,
			statisticsSending: true,
			locationTracking: false,
			advIdentifiersTracking: false,
		});
		activated = true;
	} catch {
		// Analytics stays disabled when native module is missing.
	}
}

export type AnalyticsReporter = {
	reportEvent: (
		eventName: string,
		attributes?: Record<string, string | number | boolean>
	) => void;
};

/** Default reporter backed by AppMetrica — swallows all errors. */
export function createAppMetricaReporter(): AnalyticsReporter {
	return {
		reportEvent: (eventName, attributes) => {
			const mod = getAppMetricaModule();
			if (!mod) {
				return;
			}
			try {
				if (attributes && Object.keys(attributes).length > 0) {
					mod.reportEvent(eventName, attributes);
				} else {
					mod.reportEvent(eventName);
				}
			} catch {
				// Best-effort analytics must never surface errors to the UI.
			}
		},
	};
}

/** Resets activation state — test helper. */
export function resetAppMetricaForTests(): void {
	cachedModule = undefined;
	activated = false;
}
