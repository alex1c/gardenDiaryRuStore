/**
 * Privacy-safe analytics facade — semantic events only, no user content.
 * Domain code calls trackAnalyticsEvent; SDK details stay in the adapter.
 */

import {
	createAppMetricaReporter,
	type AnalyticsReporter,
} from './appMetricaAdapter';
import {
	SAFE_ANALYTICS_PROP_KEYS,
	type AnalyticsEventName,
	type SafeAnalyticsProps,
} from './events';

let reporter: AnalyticsReporter = createAppMetricaReporter();

/** Injects a test reporter that captures events without touching the SDK. */
export function setAnalyticsReporterForTests(next: AnalyticsReporter): void {
	reporter = next;
}

/** Restores the default AppMetrica-backed reporter. */
export function resetAnalyticsReporterForTests(): void {
	reporter = createAppMetricaReporter();
}

/** Strips unknown keys and rejects free-text values from analytics payloads. */
export function sanitizeAnalyticsProps(
	props?: SafeAnalyticsProps
): Record<string, string | number | boolean> | undefined {
	if (!props) {
		return undefined;
	}

	const sanitized: Record<string, string | number | boolean> = {};

	for (const key of SAFE_ANALYTICS_PROP_KEYS) {
		const value = props[key];
		if (value === undefined) {
			continue;
		}

		if (typeof value === 'boolean' || typeof value === 'number') {
			sanitized[key] = value;
			continue;
		}

		if (typeof value === 'string' && isCoarseEnumValue(value)) {
			sanitized[key] = value;
		}
	}

	return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

/**
 * Coarse enum guard — rejects strings that look like user-entered content.
 * Allows snake_case tokens and short known enum literals only.
 */
function isCoarseEnumValue(value: string): boolean {
	if (value.length === 0 || value.length > 48) {
		return false;
	}
	if (/\s/.test(value)) {
		return false;
	}
	return /^[a-z0-9_]+$/.test(value);
}

/** Emits a semantic analytics event — failures are swallowed silently. */
export function trackAnalyticsEvent(
	eventName: AnalyticsEventName,
	props?: SafeAnalyticsProps
): void {
	try {
		const attributes = sanitizeAnalyticsProps(props);
		reporter.reportEvent(eventName, attributes);
	} catch {
		// Analytics must never break user flows.
	}
}
