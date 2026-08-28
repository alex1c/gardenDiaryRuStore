/**
 * Ещё — app identity and reminder settings.
 */

import { useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { RestorePreviewModal } from '@/src/components/backup/RestorePreviewModal';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { Screen } from '@/src/components/ui/Screen';
import { useAppSettings } from '@/src/hooks/useAppSettings';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import { useSeasonContext } from '@/src/providers/SeasonProvider';
import { SettingsRepository } from '@/src/repositories/SettingsRepository';
import { pickBackupJsonFile, shareBackupJson, shareCsvExport } from '@/src/services/backup/backupFileService';
import { createBackupJson } from '@/src/services/backup/createBackup';
import {
  createExpoBackupPhotoReader,
  createExpoBackupPhotoWriter,
} from '@/src/services/backup/photoBackupIo';
import { restoreBackupV1 } from '@/src/services/backup/restoreBackup';
import { parseAndValidateBackupJson } from '@/src/services/backup/validateBackup';
import type { BackupPreview, GardenDiaryBackupV1 } from '@/src/services/backup/backupTypes';
import { exportGardenCsv } from '@/src/services/export/exportData';
import {
  requestNotificationPermission,
  syncDailyReminder,
} from '@/src/services/notificationScheduler';
import { colors, spacing, typography } from '@/src/theme/tokens';
import { parseNotificationTime } from '@/src/utils/dateFormatRu';

const HOUR_OPTIONS = [7, 8, 9, 10, 11];

export default function MoreScreen() {
  const router = useRouter();
  const { db, bumpRefresh } = useDatabase();
  const { resetViewedSeason, reload: reloadSeasons } = useSeasonContext();
  const { settings, patchSettings } = useAppSettings();
  const [busy, setBusy] = useState(false);
  const [restorePreview, setRestorePreview] = useState<BackupPreview | null>(null);
  const [pendingRestore, setPendingRestore] = useState<GardenDiaryBackupV1 | null>(null);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const restoreInProgress = useRef(false);

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

  const handleCreateBackup = async () => {
    if (!db) {
      return;
    }
    setBusy(true);
    try {
      const backup = await createBackupJson(db, createExpoBackupPhotoReader());
      await shareBackupJson(backup);
      Alert.alert('Резервная копия', 'Файл готов к сохранению или отправке.');
    } catch {
      Alert.alert('Резервная копия', 'Не удалось создать резервную копию.');
    } finally {
      setBusy(false);
    }
  };

  const handlePickRestore = async () => {
    setBusy(true);
    try {
      const picked = await pickBackupJsonFile();
      if (picked.cancelled) {
        return;
      }
      const parsed = parseAndValidateBackupJson(picked.text);
      if (!parsed.ok) {
        Alert.alert('Восстановление', parsed.message);
        return;
      }
      setPendingRestore(parsed.backup);
      setRestorePreview(parsed.preview);
      setRestoreOpen(true);
    } catch {
      Alert.alert('Восстановление', 'Не удалось прочитать файл');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmRestore = async () => {
    if (!db || !pendingRestore || restoreInProgress.current) {
      return;
    }
    restoreInProgress.current = true;
    setBusy(true);
    try {
      await restoreBackupV1(db, pendingRestore, createExpoBackupPhotoWriter());
      resetViewedSeason();
      reloadSeasons();
      bumpRefresh();
      setRestoreOpen(false);
      setPendingRestore(null);
      setRestorePreview(null);
      void syncDailyReminder(new SettingsRepository(db).getSettings()).catch(() => {});
      Alert.alert('Восстановление', 'Данные успешно восстановлены.');
    } catch {
      Alert.alert('Восстановление', 'Не удалось восстановить данные');
    } finally {
      restoreInProgress.current = false;
      setBusy(false);
    }
  };

  const handleExportCsv = async () => {
    if (!db) {
      return;
    }
    setBusy(true);
    try {
      const csv = exportGardenCsv(db);
      await shareCsvExport(csv);
    } catch {
      Alert.alert('Экспорт CSV', 'Не удалось подготовить экспорт.');
    } finally {
      setBusy(false);
    }
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
        <Text style={styles.sectionTitle}>Данные</Text>
        <Card style={styles.card}>
          <Text style={styles.body}>
            Сохраните данные участка, сезонов и дневника.
          </Text>
          <Button
            title="Создать резервную копию"
            variant="secondary"
            disabled={busy}
            onPress={handleCreateBackup}
          />
          <Text style={styles.body}>
            Текущие данные будут заменены после подтверждения.
          </Text>
          <Button
            title="Восстановить из копии"
            variant="secondary"
            disabled={busy}
            onPress={handlePickRestore}
          />
          <Text style={styles.body}>Для Excel и личного архива.</Text>
          <Button
            title="Экспорт CSV"
            variant="secondary"
            disabled={busy}
            onPress={handleExportCsv}
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

      <RestorePreviewModal
        visible={restoreOpen}
        preview={restorePreview}
        busy={busy}
        onConfirm={handleConfirmRestore}
        onCancel={() => {
          if (busy) {
            return;
          }
          setRestoreOpen(false);
          setPendingRestore(null);
          setRestorePreview(null);
        }}
      />
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
