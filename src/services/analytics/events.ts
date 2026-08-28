/**
 * Stable snake_case analytics event names.
 * Do not rename without a deliberate analytics schema migration.
 */

export const ANALYTICS_EVENTS = {
	APP_OPEN: 'app_open',
	GARDEN_CREATED: 'garden_created',
	AREA_CREATED: 'area_created',
	PLANTING_CREATED: 'planting_created',
	TASK_CREATED: 'task_created',
	TASK_COMPLETED: 'task_completed',
	HARVEST_ADDED: 'harvest_added',
	EXPENSE_ADDED: 'expense_added',
	SEASON_CREATED: 'season_created',
	BACKUP_CREATED: 'backup_created',
	RESTORE_COMPLETED: 'restore_completed',
	STATS_OPENED: 'stats_opened',
	CSV_EXPORTED: 'csv_exported',
} as const;

export type AnalyticsEventName =
	(typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

/** Coarse, privacy-safe optional properties — never user-entered text or ids. */
export type SafeAnalyticsProps = {
	area_type?: string;
	task_type?: string;
	repeat_type?: string;
	planting_status?: string;
	season_creation_mode?: 'empty' | 'clone';
	backup_photo_mode?: 'embedded' | 'metadata_only';
	expense_category?: string;
	harvest_unit?: string;
	is_perennial?: boolean;
	copied_from_previous?: boolean;
};

/** Allowed property keys — anything else is stripped before send. */
export const SAFE_ANALYTICS_PROP_KEYS = new Set<keyof SafeAnalyticsProps>([
	'area_type',
	'task_type',
	'repeat_type',
	'planting_status',
	'season_creation_mode',
	'backup_photo_mode',
	'expense_category',
	'harvest_unit',
	'is_perennial',
	'copied_from_previous',
]);
