/**
 * Checks interstitial eligibility when Today tab gains focus after meaningful work.
 */

import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { useDatabase } from '@/src/providers/DatabaseProvider';
import { hasPendingSafeTrigger } from '@/src/services/ads/adSession';
import { tryShowInterstitialAtSafePoint } from '@/src/services/ads/interstitialService';

/** Safe interstitial hook for neutral root screens — Today tab only in v1. */
export function useSafeInterstitialOnFocus(): void {
	const { settingsRepository } = useDatabase();

	useFocusEffect(
		useCallback(() => {
			if (!settingsRepository || !hasPendingSafeTrigger()) {
				return;
			}

			void tryShowInterstitialAtSafePoint(
				settingsRepository,
				true
			).catch(() => undefined);
		}, [settingsRepository])
	);
}
