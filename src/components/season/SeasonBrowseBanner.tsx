/**
 * Banner shown when browsing an archived/non-active season.
 */

import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/src/components/ui/Button';
import { useSeasonContext } from '@/src/providers/SeasonProvider';
import { colors, radii, spacing, typography } from '@/src/theme/tokens';

export function SeasonBrowseBanner() {
	const { isViewingArchive, viewedSeason, activeSeason, resetViewedSeason, setActiveSeasonId } =
		useSeasonContext();

	if (!isViewingArchive || !viewedSeason) {
		return null;
	}

	return (
		<View style={styles.banner}>
			<Text style={styles.text}>
				Вы смотрите {viewedSeason.title}
				{activeSeason ? `\nСейчас работает ${activeSeason.title}.` : ''}
			</Text>
			<View style={styles.actions}>
				<Button title="К текущему сезону" variant="secondary" onPress={resetViewedSeason} />
				<Button
					title="Сделать активным"
					onPress={() => setActiveSeasonId(viewedSeason.id)}
				/>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	banner: {
		marginBottom: spacing.md,
		padding: spacing.md,
		backgroundColor: colors.primarySoft,
		borderRadius: radii.md,
		gap: spacing.sm,
	},
	text: {
		...typography.body,
		color: colors.text,
	},
	actions: {
		gap: spacing.sm,
	},
});
