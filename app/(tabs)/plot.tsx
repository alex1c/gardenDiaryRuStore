/**
 * Участок — garden name, area list, add-area CTA.
 */

import { useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { Screen } from '@/src/components/ui/Screen';
import { GARDEN_AREA_TYPE_LABELS } from '@/src/domain/codes';
import { useGardenSnapshot } from '@/src/hooks/useGardenSnapshot';
import { colors, spacing, typography } from '@/src/theme/tokens';

export default function PlotScreen() {
  const router = useRouter();
  const { loading, garden, areas } = useGardenSnapshot();

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
          title="Участок ещё не создан"
          message="Сначала создайте участок на вкладке «Сегодня»."
        >
          <Button
            title="Создать участок"
            onPress={() => router.push('/garden/create')}
          />
        </EmptyState>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Text style={styles.heading}>{garden.name}</Text>
      {garden.locationName ? (
        <Text style={styles.sub}>{garden.locationName}</Text>
      ) : null}

      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Зоны</Text>
        <Button
          title="Добавить"
          variant="secondary"
          onPress={() => router.push('/area/create')}
          style={styles.addBtn}
        />
      </View>

      {areas.length === 0 ? (
        <EmptyState
          title="Пока нет зон"
          message="Добавьте грядку, теплицу или другую зону."
        >
          <Button
            title="Добавить зону"
            onPress={() => router.push('/area/create')}
          />
        </EmptyState>
      ) : (
        <View style={styles.list}>
          {areas.map((area) => (
            <Card key={area.id} style={styles.areaCard}>
              <Text style={styles.areaName}>{area.name}</Text>
              <Text style={styles.areaType}>
                {GARDEN_AREA_TYPE_LABELS[area.type]}
              </Text>
            </Card>
          ))}
        </View>
      )}
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
    marginBottom: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.subtitle,
    color: colors.text,
    flex: 1,
  },
  addBtn: {
    paddingHorizontal: spacing.md,
  },
  list: {
    gap: spacing.sm,
  },
  areaCard: {
    gap: spacing.xs,
  },
  areaName: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
  },
  areaType: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
