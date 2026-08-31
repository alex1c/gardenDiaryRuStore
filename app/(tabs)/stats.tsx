/**
 * Statistics tab — season harvest and expense summaries.
 */

import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { GardenBannerAd } from '@/src/components/ads/GardenBannerAd';
import { SeasonBrowseBanner } from '@/src/components/season/SeasonBrowseBanner';
import { Button } from '@/src/components/ui/Button';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { Screen } from '@/src/components/ui/Screen';
import { useGardenSnapshot } from '@/src/hooks/useGardenSnapshot';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import { ExpenseStatsService } from '@/src/services/expenseStatsService';
import { HarvestStatsService } from '@/src/services/harvestStatsService';
import { trackAnalyticsEvent } from '@/src/services/analytics/analytics';
import { ANALYTICS_EVENTS } from '@/src/services/analytics/events';
import { colors, spacing, typography } from '@/src/theme/tokens';

export default function StatsScreen() {
  const router = useRouter();
  const { db, refreshToken } = useDatabase();
  const { loading, garden, season } = useGardenSnapshot();

  useFocusEffect(
    useCallback(() => {
      trackAnalyticsEvent(ANALYTICS_EVENTS.STATS_OPENED);
    }, [])
  );

  const stats = useMemo(() => {
    if (!db || !season) {
      return null;
    }
    const harvestService = new HarvestStatsService(db);
    const expenseService = new ExpenseStatsService(db);
    return {
      harvest: {
        summary: harvestService.getSeasonHarvestSummary(season.id),
        crops: harvestService.getCropTotals(season.id),
        varieties: harvestService.getVarietyTotals(season.id),
        plantings: harvestService.getPlantingTotals(season.id),
      },
      expenses: {
        summary: expenseService.getSeasonExpenseSummary(season.id),
        categories: expenseService.getExpenseTotalsByCategory(season.id),
        areas: expenseService.getExpenseTotalsByArea(season.id),
        plantings: expenseService.getPlantingExpenseSummaries(season.id),
        costPerKg: expenseService.getSeasonCostPerKg(season.id),
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refreshToken busts cache
  }, [db, season, refreshToken]);

  if (loading) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (!garden || !season || !stats) {
    return (
      <Screen scroll>
        <EmptyState
          title="Статистика"
          message="Создайте участок и сезон, чтобы видеть сводки."
        />
      </Screen>
    );
  }

  const hasHarvest = stats.harvest.summary.harvestCount > 0;
  const hasExpenses = stats.expenses.summary.expenseCount > 0;
  const maxCropGrams = stats.harvest.crops[0]?.weightGrams ?? 1;
  const maxCategoryKopecks =
    stats.expenses.categories[0]?.totalKopecks ?? 1;

  if (!hasHarvest && !hasExpenses) {
    return (
      <Screen scroll>
        <Text style={styles.heading}>Статистика</Text>
        <Text style={styles.seasonLine}>
          {garden.name} · {season.title}
        </Text>
        <EmptyState
          title="Сводки появятся позже"
          message="Добавляйте урожай и расходы — здесь появятся итоги по сезону."
        >
          <View style={styles.emptyActions}>
            <Button
              title="+ Добавить урожай"
              onPress={() => router.push('/harvest/create')}
            />
            <Button
              title="+ Добавить расход"
              variant="secondary"
              onPress={() => router.push('/expense/create')}
            />
          </View>
        </EmptyState>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <SeasonBrowseBanner />
      <Text style={styles.heading}>Статистика</Text>
      <Text style={styles.seasonLine}>
        {garden.name} · {season.title}
      </Text>

      {hasHarvest ? (
        <>
          <View style={styles.block}>
            <Text style={styles.blockTitle}>Урожай за сезон</Text>
            <Text style={styles.bigTotalHarvest}>
              {stats.harvest.summary.totalsText ?? '0'}
            </Text>
          </View>

          {stats.harvest.crops.length > 0 ? (
            <View style={styles.block}>
              <Text style={styles.blockTitle}>По культурам</Text>
              {stats.harvest.crops.map((crop, index) => (
                <View key={crop.speciesName} style={styles.rankRow}>
                  <Text style={styles.rankIndex}>{index + 1}.</Text>
                  <View style={styles.rankContent}>
                    <View style={styles.rankHeader}>
                      <Text style={styles.rankLabel} numberOfLines={2}>
                        {crop.speciesName}
                      </Text>
                      <Text style={styles.rankValue}>{crop.displayTotal}</Text>
                    </View>
                    {crop.weightGrams > 0 ? (
                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.barFillHarvest,
                            {
                              width: `${(crop.weightGrams / maxCropGrams) * 100}%`,
                            },
                          ]}
                        />
                      </View>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          {stats.harvest.varieties.length > 0 ? (
            <View style={styles.block}>
              <Text style={styles.blockTitle}>Лучшие сорта</Text>
              {stats.harvest.varieties.slice(0, 8).map((item) => (
                <View
                  key={`${item.speciesName}-${item.varietyName ?? ''}`}
                  style={styles.lineRow}
                >
                  <Text style={styles.lineLabel} numberOfLines={2}>
                    {item.label}
                  </Text>
                  <Text style={styles.lineValue}>{item.displayTotal}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </>
      ) : null}

      {hasExpenses ? (
        <>
          <View style={styles.block}>
            <Text style={styles.blockTitle}>Расходы за сезон</Text>
            <Text style={styles.bigTotalExpense}>
              {stats.expenses.summary.displayTotal}
            </Text>
            {stats.expenses.costPerKg ? (
              <Text style={styles.costPerKg}>
                {stats.expenses.costPerKg.displayText}
              </Text>
            ) : null}
          </View>

          {stats.expenses.categories.length > 0 ? (
            <View style={styles.block}>
              <Text style={styles.blockTitle}>На что потрачено</Text>
              {stats.expenses.categories.map((item) => (
                <View key={item.category} style={styles.rankRow}>
                  <View style={styles.rankContent}>
                    <View style={styles.rankHeader}>
                      <Text style={styles.rankLabel} numberOfLines={2}>
                        {item.label}
                      </Text>
                      <Text style={styles.rankValue}>{item.displayTotal}</Text>
                    </View>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFillExpense,
                          {
                            width: `${(item.totalKopecks / maxCategoryKopecks) * 100}%`,
                          },
                        ]}
                      />
                    </View>
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          {stats.expenses.areas.areas.length > 0 ||
          stats.expenses.areas.commonDisplayTotal ? (
            <View style={styles.block}>
              <Text style={styles.blockTitle}>По зонам</Text>
              {stats.expenses.areas.areas.map((item) => (
                <View key={item.areaId} style={styles.lineRow}>
                  <Text style={styles.lineLabel} numberOfLines={2}>
                    {item.areaName}
                  </Text>
                  <Text style={styles.lineValue}>{item.displayTotal}</Text>
                </View>
              ))}
              {stats.expenses.areas.commonDisplayTotal ? (
                <View style={styles.lineRow}>
                  <Text style={styles.lineLabel}>Общие расходы</Text>
                  <Text style={styles.lineValue}>
                    {stats.expenses.areas.commonDisplayTotal}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {stats.expenses.plantings.length > 0 ? (
            <View style={styles.block}>
              <Text style={styles.blockTitle}>Расходы по посадкам</Text>
              {stats.expenses.plantings.slice(0, 6).map((item) => (
                <View key={item.plantingId} style={styles.plantingCard}>
                  <Text style={styles.plantingTitle} numberOfLines={2}>
                    {item.label}
                  </Text>
                  <Text style={styles.plantingTotal}>{item.displayTotal}</Text>
                  {item.conditionalCostPerKg ? (
                    <Text style={styles.yieldHint}>{item.conditionalCostPerKg}</Text>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}

          <Button
            title="Все расходы"
            variant="secondary"
            onPress={() => router.push('/expense/list')}
          />
        </>
      ) : (
        <View style={styles.block}>
          <EmptyState
            title="Расходы пока не записаны"
            message="Добавляйте покупки и затраты, чтобы видеть стоимость сезона."
          >
            <Button
              title="+ Добавить расход"
              onPress={() => router.push('/expense/create')}
            />
          </EmptyState>
        </View>
      )}

      <View style={styles.footerActions}>
        {hasHarvest ? (
          <Button
            title="+ Добавить урожай"
            variant="secondary"
            onPress={() => router.push('/harvest/create')}
          />
        ) : null}
        <Button
          title="+ Добавить расход"
          onPress={() => router.push('/expense/create')}
        />
      </View>

      <GardenBannerAd placement="stats" />
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
  },
  seasonLine: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  block: {
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  blockTitle: {
    ...typography.subtitle,
    color: colors.text,
  },
  bigTotalHarvest: {
    ...typography.title,
    color: colors.primary,
    fontSize: 32,
  },
  bigTotalExpense: {
    ...typography.title,
    color: colors.text,
    fontSize: 32,
  },
  costPerKg: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  rankRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  rankIndex: {
    ...typography.body,
    color: colors.textMuted,
    width: 20,
  },
  rankContent: {
    flex: 1,
    gap: spacing.xs,
  },
  rankHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  rankLabel: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },
  rankValue: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    flexShrink: 0,
  },
  barTrack: {
    height: 6,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFillHarvest: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
    minWidth: 4,
  },
  barFillExpense: {
    height: '100%',
    backgroundColor: colors.textSecondary,
    borderRadius: 3,
    minWidth: 4,
  },
  lineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  lineLabel: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },
  lineValue: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    flexShrink: 0,
  },
  plantingCard: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 12,
    gap: spacing.xs,
  },
  plantingTitle: {
    ...typography.subtitle,
    color: colors.text,
  },
  plantingTotal: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  yieldHint: {
    ...typography.caption,
    color: colors.textMuted,
  },
  emptyActions: {
    gap: spacing.sm,
  },
  footerActions: {
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
});
