/**
 * Resets installation-specific ad counters when restoring from backup.
 * User-facing settings (active garden/season, notifications) are preserved.
 */

/** app_settings keys that must not travel with a portable backup. */
export const NON_PORTABLE_AD_SETTING_KEYS = new Set([
	'qualifyingSessionCount',
	'lastInterstitialSession',
]);

export type AppSettingsRow = Record<string, unknown>;

/** Returns app_settings rows safe to insert after restore on this device. */
export function normalizeAppSettingsRowsForRestore(
	rows: AppSettingsRow[]
): AppSettingsRow[] {
	return rows.map((row) => {
		const key = String(row.key ?? '');
		if (!NON_PORTABLE_AD_SETTING_KEYS.has(key)) {
			return row;
		}

		return {
			...row,
			value: '0',
		};
	});
}
