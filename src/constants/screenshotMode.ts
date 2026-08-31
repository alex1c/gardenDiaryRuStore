/**
 * Dev-only flag for RuStore screenshot capture.
 * Hides banner containers without changing interstitial policy or production IDs.
 */

export const hideBannersForStoreScreenshots =
	__DEV__ && process.env.EXPO_PUBLIC_HIDE_STORE_BANNERS === '1';
