/**
 * Bottom banner slot — collapses silently when the ad fails to load.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import type { BannerPlacement } from '@/src/constants/monetization';
import { spacing } from '@/src/theme/tokens';
import { getBannerPlacementConfig } from '@/src/services/ads/bannerConfig';
import { getYandexAdsModule } from '@/src/services/ads/yandexAdsAdapter';

type GardenBannerAdProps = {
	placement: BannerPlacement;
};

export function GardenBannerAd({ placement }: GardenBannerAdProps) {
	const [visible, setVisible] = useState(true);
	const [bannerSize, setBannerSize] = useState<unknown>(null);
	const config = useMemo(() => getBannerPlacementConfig(placement), [placement]);
	const yandex = getYandexAdsModule();

	const handleFailed = useCallback(() => {
		setVisible(false);
	}, []);

	useEffect(() => {
		if (!config.adUnitId || !yandex || Platform.OS === 'web') {
			return;
		}

		let cancelled = false;
		void yandex.BannerAdSize.stickySize(320)
			.then((size) => {
				if (!cancelled) {
					setBannerSize(size);
				}
			})
			.catch(() => {
				if (!cancelled) {
					setVisible(false);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [config.adUnitId, yandex]);

	if (!config.adUnitId || !visible || !yandex || Platform.OS === 'web' || !bannerSize) {
		return null;
	}

	const { BannerView } = yandex;

	return (
		<View
			style={styles.container}
			accessibilityElementsHidden
			importantForAccessibility="no-hide-descendants"
		>
			<BannerView
				size={bannerSize as never}
				adRequest={{ adUnitId: config.adUnitId }}
				onAdFailedToLoad={handleFailed}
				style={styles.banner}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		alignItems: 'center',
		marginTop: spacing.lg,
		marginBottom: spacing.md,
	},
	banner: {
		width: 320,
		height: 50,
	},
});
