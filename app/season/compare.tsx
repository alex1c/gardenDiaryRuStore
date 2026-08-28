/**
 * Simple season comparison — harvest, expenses, conditional cost/kg.
 */

import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/src/components/ui/EmptyState';
import { Screen } from '@/src/components/ui/Screen';
import { useGardenSnapshot } from '@/src/hooks/useGardenSnapshot';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import { getSeasonComparison } from '@/src/services/seasonComparisonService';
import { colors, spacing, typography } from '@/src/theme/tokens';

export default function SeasonCompareScreen() {
  const { db, refreshToken } = useDatabase();
  const { loading, garden } = useGardenSnapshot();

  const rows = useMemo(() => {
    if (!db || !garden) {
      return [];
    }
    return getSeasonComparison(db, garden.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refreshToken busts cache
  }, [db, garden, refreshToken]);

  if (loading) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (rows.length < 2) {
    return (
      <Screen scroll>
        <EmptyState
          title="Сравнение сезонов"
          message="Нужно минимум два сезона с данными."
        />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Text style={styles.heading}>Сравнение сезонов</Text>
      {rows.map((row) => (
        <View key={row.season.id} style={styles.block}>
          <Text style={styles.seasonTitle}>{row.season.title}</Text>
          <Text style={styles.line}>
            Урожай: {row.harvestTotalsText ?? '—'}
          </Text>
          <Text style={styles.line}>
            Расходы: {row.expenseDisplayTotal}
          </Text>
          {row.conditionalCostPerKg ? (
            <Text style={styles.cost}>{row.conditionalCostPerKg}</Text>
          ) : null}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  block: {
    marginBottom: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 12,
    gap: spacing.xs,
  },
  seasonTitle: {
    ...typography.subtitle,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  line: {
    ...typography.body,
    color: colors.textSecondary,
  },
  cost: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
});
