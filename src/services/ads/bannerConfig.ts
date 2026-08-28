/**
 * Banner placement metadata — keeps UI free of ad unit id selection logic.
 */

import {
	getBannerAdUnitId,
	type BannerPlacement,
} from '@/src/constants/monetization';

export type BannerPlacementConfig = {
	placement: BannerPlacement;
	adUnitId: string;
};

/** Resolves banner config for a supported screen placement. */
export function getBannerPlacementConfig(
	placement: BannerPlacement
): BannerPlacementConfig {
	return {
		placement,
		adUnitId: getBannerAdUnitId(placement),
	};
}
