/**
 * Pure interstitial eligibility rules — no SDK or UI dependencies.
 * All frequency caps and session spacing live here for unit testing.
 */

import {
	MIN_SESSIONS_BEFORE_FIRST_INTERSTITIAL,
	SESSIONS_BETWEEN_INTERSTITIALS,
} from '@/src/constants/monetization';

export type AdPolicyConfig = {
	minSessionsBeforeFirstInterstitial: number;
	sessionsBetweenInterstitials: number;
};

export const DEFAULT_AD_POLICY_CONFIG: AdPolicyConfig = {
	minSessionsBeforeFirstInterstitial: MIN_SESSIONS_BEFORE_FIRST_INTERSTITIAL,
	sessionsBetweenInterstitials: SESSIONS_BETWEEN_INTERSTITIALS,
};

/** Persisted counters used to decide interstitial eligibility. */
export type AdPolicyPersistedState = {
	qualifyingSessionCount: number;
	lastInterstitialSession: number;
};

/** In-memory guards for the current foreground session. */
export type AdPolicySessionState = {
	shownThisSession: boolean;
	hasPendingSafeTrigger: boolean;
};

export type InterstitialEligibilityInput = AdPolicyPersistedState &
	AdPolicySessionState & {
		adReady: boolean;
	};

/**
 * Returns true when policy allows attempting an interstitial show.
 * Callers must still verify SDK readiness and safe UI context.
 */
export function isInterstitialEligible(
	input: InterstitialEligibilityInput,
	config: AdPolicyConfig = DEFAULT_AD_POLICY_CONFIG
): boolean {
	if (!input.adReady) {
		return false;
	}
	if (!input.hasPendingSafeTrigger) {
		return false;
	}
	if (input.shownThisSession) {
		return false;
	}
	if (
		input.qualifyingSessionCount <
		config.minSessionsBeforeFirstInterstitial
	) {
		return false;
	}

	if (input.lastInterstitialSession <= 0) {
		return (
			input.qualifyingSessionCount >=
			config.minSessionsBeforeFirstInterstitial
		);
	}

	const sessionsSinceLast =
		input.qualifyingSessionCount - input.lastInterstitialSession;
	return sessionsSinceLast >= config.sessionsBetweenInterstitials;
}

/** Updates persisted state after a successful interstitial display. */
export function recordInterstitialShown(
	state: AdPolicyPersistedState,
	atSession: number
): AdPolicyPersistedState {
	return {
		...state,
		lastInterstitialSession: atSession,
	};
}
