/**
 * Phase 11 — production release configuration validation.
 */

import appJson from '../app.json';
import {
	APPMETRICA_PRODUCTION_API_KEY,
	PRODUCTION_AD_UNITS,
	YANDEX_DEMO_AD_UNITS,
	getAppMetricaApiKey,
	getBannerAdUnitId,
	getInterstitialAdUnitId,
	getProductionMonetizationSnapshot,
	isProductionMonetizationConfigured,
} from '@/src/constants/monetization';

describe('Phase 11 — production monetization config', () => {
	it('stores approved production identifiers centrally', () => {
		expect(APPMETRICA_PRODUCTION_API_KEY).toBe(
			'0dc64afa-6bda-4b04-824c-bf253829ebe6'
		);
		expect(PRODUCTION_AD_UNITS.bannerToday).toBe('R-M-19846495-1');
		expect(PRODUCTION_AD_UNITS.bannerStats).toBe('R-M-19846495-1');
		expect(PRODUCTION_AD_UNITS.interstitial).toBe('R-M-19846495-2');
	});

	it('maps release runtime to production ids without demo fallback', () => {
		expect(getProductionMonetizationSnapshot()).toEqual({
			appMetricaApiKey: '0dc64afa-6bda-4b04-824c-bf253829ebe6',
			bannerToday: 'R-M-19846495-1',
			bannerStats: 'R-M-19846495-1',
			interstitial: 'R-M-19846495-2',
		});
	});

	it('marks production monetization as fully configured', () => {
		expect(isProductionMonetizationConfigured()).toBe(true);
	});

	it('keeps debug builds on demo ad units', () => {
		if (__DEV__) {
			expect(getBannerAdUnitId('today')).toBe(YANDEX_DEMO_AD_UNITS.banner);
			expect(getInterstitialAdUnitId()).toBe(
				YANDEX_DEMO_AD_UNITS.interstitial
			);
			expect(getAppMetricaApiKey()).toBe(
				'00000000-0000-0000-0000-000000000000'
			);
		}
	});
});

describe('Phase 11 — release app metadata', () => {
	it('uses first RuStore version metadata', () => {
		expect(appJson.expo.version).toBe('1.0.0');
		expect(appJson.expo.android.versionCode).toBe(1);
		expect(appJson.expo.android.package).toBe(
			'com.calculatorplatform.gardendiary'
		);
		expect(appJson.expo.name).toBe('Моя дача');
	});
});
