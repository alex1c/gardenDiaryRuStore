/**
 * Initializes analytics/ads once and tracks qualifying app sessions.
 */

import { useEffect, useRef, type ReactNode } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { useDatabase } from '@/src/providers/DatabaseProvider';
import {
	consumeAppOpenTrackingSlot,
	isForegroundSessionCounted,
	markForegroundSessionCounted,
	onAppMovedToBackground,
} from '@/src/services/ads/adSession';
import {
	preloadInterstitial,
	registerQualifyingSession,
} from '@/src/services/ads/interstitialService';
import { initializeYandexAds } from '@/src/services/ads/yandexAdsAdapter';
import { trackAnalyticsEvent } from '@/src/services/analytics/analytics';
import { ANALYTICS_EVENTS } from '@/src/services/analytics/events';
import { initializeAppMetrica } from '@/src/services/analytics/appMetricaAdapter';

type MonetizationProviderProps = {
	children: ReactNode;
};

export function MonetizationProvider({ children }: MonetizationProviderProps) {
	const { ready, settingsRepository } = useDatabase();
	const appState = useRef<AppStateStatus>(AppState.currentState);

	useEffect(() => {
		if (!ready) {
			return;
		}

		initializeAppMetrica();
		void initializeYandexAds().finally(() => {
			preloadInterstitial();
		});

		if (consumeAppOpenTrackingSlot()) {
			trackAnalyticsEvent(ANALYTICS_EVENTS.APP_OPEN);
		}
	}, [ready]);

	useEffect(() => {
		if (!ready || !settingsRepository) {
			return;
		}

		const countSessionIfNeeded = () => {
			if (isForegroundSessionCounted()) {
				return;
			}
			registerQualifyingSession(settingsRepository);
			markForegroundSessionCounted();
			preloadInterstitial();
		};

		countSessionIfNeeded();

		const subscription = AppState.addEventListener('change', (nextState) => {
			const prev = appState.current;
			appState.current = nextState;

			if (prev === 'background' && nextState === 'active') {
				countSessionIfNeeded();
				return;
			}

			if (nextState === 'background') {
				onAppMovedToBackground();
			}
		});

		return () => {
			subscription.remove();
		};
	}, [ready, settingsRepository]);

	return children;
}
