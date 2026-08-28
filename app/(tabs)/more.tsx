/**
 * Ещё — app identity and reminder settings.
 */

import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { Screen } from '@/src/components/ui/Screen';
import { useAppSettings } from '@/src/hooks/useAppSettings';
import {
  requestNotificationPermission,
  syncDailyReminder,
} from '@/src/services/notificationScheduler';
import { colors, spacing, typography } from '@/src/theme/tokens';
import { parseNotificationTime } from '@/src/utils/dateFormatRu';

const HOUR_OPTIONS = [7, 8, 9, 10, 11];

export default function MoreScreen() {
  const router = useRouter();
  const { settings, patchSettings } = useAppSettings();
  const [busy, setBusy] = useState(false);

  const { hour: currentHour } = parseNotificationTime(settings.notificationTime);

  const handleToggleNotifications = async () => {
    setBusy(true);
    try {
      if (settings.notificationsEnabled) {
        const next = patchSettings({ notificationsEnabled: false });
        await syncDailyReminder(next);
        return;
      }

      const granted = await requestNotificationPermission();
      const next = patchSettings({
        notificationsEnabled: granted,
        notificationsPromptShown: true,
      });
      await syncDailyReminder(next);
    } finally {
      setBusy(false);
    }
  };

  const handleHourSelect = async (hour: number) => {
    const time = `${String(hour).padStart(2, '0')}:00`;
    const next = patchSettings({ notificationTime: time });
    await syncDailyReminder(next);
  };

  return (
    <Screen scroll>
      <Card style={styles.card}>
        <Text style={styles.title}>Моя дача</Text>
        <Text style={styles.sub}>Дневник сада и огорода</Text>
        <Text style={styles.body}>
          Локальное приложение без обязательной регистрации.
        </Text>
      </Card>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Сезоны</Text>
        <Card style={styles.card}>
          <Text style={styles.body}>
            Завершите текущий сезон и начните новый без потери многолетников.
          </Text>
          <Button
            title="Управление сезонами"
            variant="secondary"
            onPress={() => router.push('/season/index')}
          />
        </Card>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Напоминания</Text>
        <Card style={styles.card}>
          <Text style={styles.rowLabel}>
            {settings.notificationsEnabled ? 'Включены' : 'Выключены'}
          </Text>
          <Button
            title={settings.notificationsEnabled ? 'Выключить' : 'Включить'}
            variant="secondary"
            disabled={busy}
            onPress={handleToggleNotifications}
          />
          {settings.notificationsEnabled ? (
            <View style={styles.timeBlock}>
              <Text style={styles.rowLabel}>Напоминать утром</Text>
              <View style={styles.hourRow}>
                {HOUR_OPTIONS.map((hour) => (
                  <Pressable
                    key={hour}
                    accessibilityRole="button"
                    onPress={() => handleHourSelect(hour)}
                    style={[
                      styles.hourChip,
                      hour === currentHour ? styles.hourChipSelected : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.hourLabel,
                        hour === currentHour ? styles.hourLabelSelected : null,
                      ]}
                    >
                      {String(hour).padStart(2, '0')}:00
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
        </Card>
      </View>
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
  section: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.subtitle,
    color: colors.text,
  },
  rowLabel: {
    ...typography.body,
    color: colors.text,
  },
  timeBlock: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  hourRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  hourChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 44,
    justifyContent: 'center',
  },
  hourChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  hourLabel: {
    ...typography.body,
    color: colors.text,
  },
  hourLabelSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
});
