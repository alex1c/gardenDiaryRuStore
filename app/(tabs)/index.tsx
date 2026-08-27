/**
 * Сегодня — first-run empty states and season summary CTA.
 */

import { useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { Screen } from '@/src/components/ui/Screen';
import { useGardenSnapshot } from '@/src/hooks/useGardenSnapshot';
import { colors, spacing, typography } from '@/src/theme/tokens';

export default function TodayScreen() {
  const router = useRouter();
  const { loading, garden, season, areas } = useGardenSnapshot();

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
          title="Добро пожаловать"
          message="Начните с вашего участка. Потом вы сможете добавить грядки, теплицы и растения."
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
      <Text style={styles.heading}>Сегодня</Text>
      <Text style={styles.sub}>
        {garden.name}
        {season ? ` · ${season.title}` : ''}
      </Text>

      {areas.length === 0 ? (
        <EmptyState
          title="Участок готов"
          message="Добавьте первую грядку, теплицу или другую зону — так проще понимать, где что посажено."
        >
          <Button
            title="Добавить первую грядку"
            onPress={() => router.push('/area/create')}
          />
        </EmptyState>
      ) : (
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>На участке</Text>
          <Text style={styles.cardBody}>
            Зон: {areas.length}. Задачи и посадки появятся в следующих фазах.
          </Text>
          <Button
            title="Перейти к участку"
            variant="secondary"
            onPress={() => router.push('/plot')}
          />
        </Card>
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
    marginBottom: spacing.xs,
  },
  sub: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  card: {
    gap: spacing.sm,
  },
  cardTitle: {
    ...typography.subtitle,
    color: colors.text,
  },
  cardBody: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
