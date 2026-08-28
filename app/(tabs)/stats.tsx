/**
 * Statistics tab — season harvest totals, crops, varieties, plantings.
 */

import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/src/components/ui/Button';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { Screen } from '@/src/components/ui/Screen';
import { useGardenSnapshot } from '@/src/hooks/useGardenSnapshot';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import { HarvestStatsService } from '@/src/services/harvestStatsService';
import { colors, spacing, typography } from '@/src/theme/tokens';

export default function StatsScreen() {
  const router = useRouter();
  const { db, refreshToken } = useDatabase();
  const { loading, garden, season } = useGardenSnapshot();

  const stats = useMemo(() => {
    if (!db || !season) {
      return null;
    }
    const service = new HarvestStatsService(db);
    return {
      summary: service.getSeasonHarvestSummary(season.id),
      crops: service.getCropTotals(season.id),
      varieties: service.getVarietyTotals(season.id),
      plantings: service.getPlantingTotals(season.id),
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

  if (!garden || !season) {
    return (
      <Screen scroll>
        <EmptyState
          title="Статистика"
          message="Создайте участок и сезон, чтобы видеть сводки по урожаю."
        />
      </Screen>
    );
  }

  if (!stats || stats.summary.harvestCount === 0) {
    return (
      <Screen scroll>
        <Text style={styles.heading}>Статистика</Text>
        <EmptyState
          title="Урожай пока не записан"
          message="Добавляйте сборы урожая, и здесь появится статистика по культурам и сортам."
        >
          <Button
            title="+ Добавить урожай"
            onPress={() => router.push('/harvest/create')}
          />
        </EmptyState>
      </Screen>
    );
  }

  const maxCropGrams = stats.crops[0]?.weightGrams ?? 1;

  return (
    <Screen scroll>
      <Text style={styles.heading}>Статистика</Text>
      <Text style={styles.seasonLine}>
        {garden.name} · {season.title}
      </Text>

      <View style={styles.block}>
        <Text style={styles.blockTitle}>Урожай за сезон</Text>
        <Text style={styles.bigTotal}>
          {stats.summary.totalsText ?? '0'}
        </Text>
      </View>

      {stats.crops.length > 0 ? (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>По культурам</Text>
          {stats.crops.map((crop, index) => (
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
                        styles.barFill,
                        { width: `${(crop.weightGrams / maxCropGrams) * 100}%` },
                      ]}
                    />
                  </View>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {stats.varieties.length > 0 ? (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>Лучшие сорта</Text>
          {stats.varieties.slice(0, 8).map((item) => (
            <View key={`${item.speciesName}-${item.varietyName ?? ''}`} style={styles.lineRow}>
              <Text style={styles.lineLabel} numberOfLines={2}>
                {item.label}
              </Text>
              <Text style={styles.lineValue}>{item.displayTotal}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {stats.plantings.length > 0 ? (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>По посадкам</Text>
          {stats.plantings.map((item) => (
            <View key={item.plantingId} style={styles.plantingCard}>
              <Text style={styles.plantingTitle} numberOfLines={2}>
                {item.label}
              </Text>
              {item.areaName ? (
                <Text style={styles.plantingMeta}>{item.areaName}</Text>
              ) : null}
              <Text style={styles.plantingTotal}>
                {item.totalsText ?? '—'}
              </Text>
              {item.yieldPerPlant ? (
                <Text style={styles.yieldPerPlant}>{item.yieldPerPlant}</Text>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      <Button
        title="+ Добавить урожай"
        onPress={() => router.push('/harvest/create')}
      />
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
  bigTotal: {
    ...typography.title,
    color: colors.primary,
    fontSize: 32,
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
  barFill: {
    height: '100%',
    backgroundColor: colors.primary,
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
  plantingMeta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  plantingTotal: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
  yieldPerPlant: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
