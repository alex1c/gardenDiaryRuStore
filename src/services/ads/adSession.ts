/**
 * In-memory ad session runtime — qualifying session boundaries and safe triggers.
 * Persisted counters live in AppSettings; this module tracks per-foreground state.
 */

let foregroundSessionCounted = false;
let shownInterstitialThisSession = false;
let pendingSafeInterstitialTrigger = false;
let appOpenTracked = false;

/** Clears runtime flags — used by tests and optional hard resets. */
export function resetAdSessionRuntime(): void {
	foregroundSessionCounted = false;
	shownInterstitialThisSession = false;
	pendingSafeInterstitialTrigger = false;
	appOpenTracked = false;
}

/** Called when the app moves to background — next foreground starts a new session. */
export function onAppMovedToBackground(): void {
	foregroundSessionCounted = false;
	shownInterstitialThisSession = false;
	pendingSafeInterstitialTrigger = false;
}

/** Whether the current foreground stint already incremented qualifyingSessionCount. */
export function isForegroundSessionCounted(): boolean {
	return foregroundSessionCounted;
}

/** Marks the current foreground stint as counted without incrementing again. */
export function markForegroundSessionCounted(): void {
	foregroundSessionCounted = true;
}

/** Whether an interstitial was already shown during this foreground session. */
export function hasShownInterstitialThisSession(): boolean {
	return shownInterstitialThisSession;
}

/** Records that an interstitial was displayed in the current foreground session. */
export function markInterstitialShownThisSession(): void {
	shownInterstitialThisSession = true;
}

/**
 * Marks that the user completed meaningful work and may be eligible for an ad
 * when returning to a neutral/root screen (e.g. Today tab).
 */
export function markMeaningfulActionCompleted(): void {
	pendingSafeInterstitialTrigger = true;
}

/** Whether a safe interstitial trigger is waiting for a neutral screen. */
export function hasPendingSafeTrigger(): boolean {
	return pendingSafeInterstitialTrigger;
}

/** Returns and clears the pending safe-trigger flag. */
export function consumePendingSafeTrigger(): boolean {
	if (!pendingSafeInterstitialTrigger) {
		return false;
	}
	pendingSafeInterstitialTrigger = false;
	return true;
}

/** Guards duplicate app_open analytics emissions across rerenders. */
export function consumeAppOpenTrackingSlot(): boolean {
	if (appOpenTracked) {
		return false;
	}
	appOpenTracked = true;
	return true;
}
