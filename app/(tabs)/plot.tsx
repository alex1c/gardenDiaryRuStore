/**
 * Участок — main plot screen with rich area cards.
 */

import { useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AreaCard } from '@/src/components/area/AreaCard';
import { Button } from '@/src/components/ui/Button';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { Screen } from '@/src/components/ui/Screen';
import { useGardenSnapshot } from '@/src/hooks/useGardenSnapshot';
import { colors, spacing, typography } from '@/src/theme/tokens';

export default function PlotScreen() {
  const router = useRouter();
  const {
    loading,
    garden,
    areas,
    plantingsByAreaId,
    catalogById,
  } = useGardenSnapshot();

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

      {areas.length === 0 ? (
        <EmptyState
          title="Пока нет зон"
          message="Добавьте первую грядку, теплицу или другую часть участка."
        >
          <Button
            title="+ Добавить зону"
            onPress={() => router.push('/area/create')}
          />
        </EmptyState>
      ) : (
        <>
          <View style={styles.headerRow}>
            <Text style={styles.sectionTitle}>Зоны</Text>
            <Button
              title="Добавить"
              variant="secondary"
              onPress={() => router.push('/area/create')}
              style={styles.addBtn}
            />
          </View>
          <View style={styles.list}>
            {areas.map((area) => (
              <AreaCard
                key={area.id}
                area={area}
                plantings={plantingsByAreaId.get(area.id) ?? []}
                catalogById={catalogById}
                onPress={() => router.push(`/area/${area.id}`)}
              />
            ))}
          </View>
        </>
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
});
