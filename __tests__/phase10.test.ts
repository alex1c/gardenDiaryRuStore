/**
 * Phase 10 — UX polish regressions and Android permission config.
 */

import appJson from '../app.json';
import { formatTaskRepeatLabel } from '@/src/services/taskDisplay';
import { formatCatalogLines } from '@/src/services/plantingDisplay';

describe('Phase 10 — Android permissions', () => {
	it('blocks RECORD_AUDIO in Expo Android config', () => {
		const blocked = appJson.expo.android.blockedPermissions ?? [];
		expect(blocked).toContain('android.permission.RECORD_AUDIO');
	});
});

describe('Phase 10 — task display helpers', () => {
	it('shows repeat label for weekly tasks', () => {
		expect(
			formatTaskRepeatLabel({ repeatType: 'weekly', repeatInterval: null })
		).toBe('Каждую неделю');
	});

	it('shows custom interval for every_n_days', () => {
		expect(
			formatTaskRepeatLabel({ repeatType: 'every_n_days', repeatInterval: 5 })
		).toBe('Каждые 5 дн.');
	});

	it('returns null for one-off tasks', () => {
		expect(
			formatTaskRepeatLabel({ repeatType: 'none', repeatInterval: null })
		).toBeNull();
	});
});

describe('Phase 10 — planting display helpers', () => {
	it('splits species and variety for planting cards', () => {
		expect(
			formatCatalogLines({
				id: '1',
				gardenId: 'g',
				speciesName: 'Томат',
				varietyName: 'Бычье сердце',
				notes: null,
				createdAt: 't',
				updatedAt: 't',
			})
		).toEqual({
			species: 'Томат',
			variety: 'Бычье сердце',
		});
	});
});
