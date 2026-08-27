/**
 * Ещё — Phase 0 stub with app identity.
 */

import { StyleSheet, Text } from 'react-native';

import { Card } from '@/src/components/ui/Card';
import { Screen } from '@/src/components/ui/Screen';
import { colors, spacing, typography } from '@/src/theme/tokens';

export default function MoreScreen() {
  return (
    <Screen scroll>
      <Card style={styles.card}>
        <Text style={styles.title}>Моя дача</Text>
        <Text style={styles.sub}>Дневник сада и огорода</Text>
        <Text style={styles.body}>
          Локальное приложение без обязательной регистрации. Настройки, резервные
          копии и аналитика появятся в следующих фазах.
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
  sub: {
    ...typography.subtitle,
    color: colors.primary,
  },
  body: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
