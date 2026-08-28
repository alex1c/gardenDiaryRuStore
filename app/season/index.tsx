/**
 * Seasons list — active season, archive browse, and actions.
 */

import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { Screen } from '@/src/components/ui/Screen';
import { useGardenSnapshot } from '@/src/hooks/useGardenSnapshot';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import { useSeasonContext } from '@/src/providers/SeasonProvider';
import { getSeasonComparison } from '@/src/services/seasonComparisonService';
import { colors, spacing, typography } from '@/src/theme/tokens';

export default function SeasonsScreen() {
  const router = useRouter();
  const { db, refreshToken, bumpRefresh, seasonRepository } = useDatabase();
  const { garden, loading: snapshotLoading } = useGardenSnapshot();
  const {
    loading: seasonLoading,
    activeSeason,
    viewedSeason,
    setViewedSeasonId,
    setActiveSeasonId,
    resetViewedSeason,
  } = useSeasonContext();

  const seasons = useMemo(() => {
    if (!seasonRepository || !garden) {
      return [];
    }
    return seasonRepository.listByGarden(garden.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refreshToken busts cache
  }, [seasonRepository, garden, refreshToken]);

  const comparisonCount = useMemo(() => {
    if (!db || !garden) {
      return 0;
    }
    return getSeasonComparison(db, garden.id).length;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refreshToken busts cache
  }, [db, garden, refreshToken]);

  const loading = snapshotLoading || seasonLoading;

  const handleArchive = (seasonId: string, title: string) => {
    Alert.alert('Архивировать сезон?', title, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Архивировать',
        onPress: () => {
          seasonRepository?.update(seasonId, { archived: true });
          if (activeSeason?.id === seasonId) {
            const next = seasons.find((s) => !s.archived && s.id !== seasonId);
            if (next) {
              setActiveSeasonId(next.id);
            }
          }
          bumpRefresh();
        },
      },
    ]);
  };

  const handleOpenSeason = (seasonId: string) => {
    setViewedSeasonId(seasonId);
    bumpRefresh();
    router.back();
  };

  const handleSetActive = (seasonId: string) => {
    setActiveSeasonId(seasonId);
    resetViewedSeason();
    bumpRefresh();
  };

  if (loading) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (!garden) {
    return (
      <Screen scroll>
        <EmptyState
          title="Сезоны"
          message="Сначала создайте участок."
        />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Text style={styles.heading}>Сезоны</Text>
      <Text style={styles.sub}>{garden.name}</Text>

      <View style={styles.actions}>
        <Button
          title="Создать новый сезон"
          onPress={() => router.push('/season/create')}
        />
        {comparisonCount >= 2 ? (
          <Button
            title="Сравнение сезонов"
            variant="secondary"
            onPress={() => router.push('/season/compare')}
          />
        ) : null}
      </View>

      <View style={styles.list}>
        {seasons.map((season) => {
          const isActive = activeSeason?.id === season.id;
          const isViewed = viewedSeason?.id === season.id;
          return (
            <Card key={season.id} style={styles.card}>
              <View style={styles.row}>
                <View style={styles.meta}>
                  <Text style={styles.title}>{season.title}</Text>
                  <Text style={styles.year}>Год {season.year}</Text>
                  {isActive ? (
                    <Text style={styles.badgeActive}>Текущий</Text>
                  ) : season.archived ? (
                    <Text style={styles.badgeArchive}>Архив</Text>
                  ) : null}
                  {isViewed && !isActive ? (
                    <Text style={styles.badgeView}>Просмотр</Text>
                  ) : null}
                </View>
              </View>
              <View style={styles.rowActions}>
                {!isActive ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => handleSetActive(season.id)}
                    style={styles.linkBtn}
                  >
                    <Text style={styles.linkText}>Сделать текущим</Text>
                  </Pressable>
                ) : null}
                {!isViewed || isActive ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => handleOpenSeason(season.id)}
                    style={styles.linkBtn}
                  >
                    <Text style={styles.linkText}>Открыть</Text>
                  </Pressable>
                ) : null}
                {!season.archived && !isActive ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => handleArchive(season.id, season.title)}
                    style={styles.linkBtn}
                  >
                    <Text style={styles.linkMuted}>Архивировать</Text>
                  </Pressable>
                ) : null}
              </View>
            </Card>
          );
        })}
      </View>
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
  sub: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  actions: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  list: {
    gap: spacing.sm,
  },
  card: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  meta: {
    gap: spacing.xs,
    flex: 1,
  },
  title: {
    ...typography.subtitle,
    color: colors.text,
  },
  year: {
    ...typography.body,
    color: colors.textSecondary,
  },
  badgeActive: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  badgeArchive: {
    ...typography.caption,
    color: colors.textMuted,
  },
  badgeView: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  rowActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  linkBtn: {
    minHeight: 44,
    justifyContent: 'center',
  },
  linkText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
  linkMuted: {
    ...typography.body,
    color: colors.textMuted,
  },
});
