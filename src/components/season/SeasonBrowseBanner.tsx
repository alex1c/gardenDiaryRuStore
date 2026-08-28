/**
 * Banner shown when browsing an archived/non-active season.
 */

import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/src/components/ui/Button';
import { useSeasonContext } from '@/src/providers/SeasonProvider';
import { colors, spacing, typography } from '@/src/theme/tokens';

export function SeasonBrowseBanner() {
  const { isViewingArchive, viewedSeason, activeSeason, resetViewedSeason } =
    useSeasonContext();

  if (!isViewingArchive || !viewedSeason) {
    return null;
  }

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>
        Просмотр: {viewedSeason.title}
        {activeSeason ? ` · текущий: ${activeSeason.title}` : ''}
      </Text>
      <Button title="К текущему сезону" variant="secondary" onPress={resetViewedSeason} />
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginBottom: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.primarySoft,
    borderRadius: 12,
    gap: spacing.sm,
  },
  text: {
    ...typography.body,
    color: colors.text,
  },
});
