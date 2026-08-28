/**
 * Create a new garden task for the active season.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, View } from 'react-native';

import { TaskForm, type TaskFormValues } from '@/src/components/task/TaskForm';
import { Button } from '@/src/components/ui/Button';
import { Screen } from '@/src/components/ui/Screen';
import { useGardenSnapshot } from '@/src/hooks/useGardenSnapshot';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import {
  requestNotificationPermission,
  syncDailyReminder,
} from '@/src/services/notificationScheduler';
import { colors, spacing, typography } from '@/src/theme/tokens';

export default function CreateTaskScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ areaId?: string; plantingId?: string }>();
  const { bumpRefresh, taskRepository, settingsRepository } = useDatabase();
  const { loading, season, areas, plantings, catalogById } = useGardenSnapshot();
  const [saving, setSaving] = useState(false);
  const [showNotifyPrompt, setShowNotifyPrompt] = useState(false);

  const handleSubmit = useCallback(
    async (values: TaskFormValues) => {
      if (!taskRepository || !season || !settingsRepository) {
        return;
      }

      setSaving(true);
      try {
        const hadTasks = taskRepository.listBySeason(season.id).length > 0;
        taskRepository.create({
          seasonId: season.id,
          title: values.title,
          type: values.type,
          dueDate: values.dueDate,
          areaId: values.areaId,
          plantingId: values.plantingId,
          repeatType: values.repeatType,
          repeatInterval: values.repeatInterval,
          notes: values.notes,
        });
        bumpRefresh();

        const settings = settingsRepository.getSettings();
        await syncDailyReminder(settings);

        if (!hadTasks && !settings.notificationsPromptShown) {
          settingsRepository.patch({ notificationsPromptShown: true });
          setShowNotifyPrompt(true);
          return;
        }

        router.back();
      } finally {
        setSaving(false);
      }
    },
    [taskRepository, season, settingsRepository, bumpRefresh, router]
  );

  const handleEnableNotifications = async () => {
    if (!settingsRepository) {
      setShowNotifyPrompt(false);
      router.back();
      return;
    }

    const granted = await requestNotificationPermission();
    const next = settingsRepository.patch({
      notificationsEnabled: granted,
      notificationsPromptShown: true,
    });
    await syncDailyReminder(next);
    setShowNotifyPrompt(false);
    router.back();
  };

  const handleSkipNotifications = () => {
    settingsRepository?.patch({ notificationsPromptShown: true });
    setShowNotifyPrompt(false);
    router.back();
  };

  if (loading || !season) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll keyboardShouldPersistTaps="handled">
      <Text style={styles.heading}>+ Добавить дело</Text>
      <TaskForm
        areas={areas}
        plantings={plantings}
        catalogById={catalogById}
        initialAreaId={params.areaId ?? null}
        initialPlantingId={params.plantingId ?? null}
        submitLabel="Сохранить"
        saving={saving}
        onSubmit={handleSubmit}
        onCancel={() => router.back()}
      />

      <Modal visible={showNotifyPrompt} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Напоминания</Text>
            <Text style={styles.modalBody}>
              Напоминать о запланированных работах?
            </Text>
            <View style={styles.modalActions}>
              <Button title="Включить" onPress={handleEnableNotifications} />
              <Button
                title="Не сейчас"
                variant="secondary"
                onPress={handleSkipNotifications}
              />
            </View>
          </View>
        </View>
      </Modal>
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
    marginBottom: spacing.md,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 360,
    gap: spacing.md,
  },
  modalTitle: {
    ...typography.subtitle,
    color: colors.text,
  },
  modalBody: {
    ...typography.body,
    color: colors.textSecondary,
  },
  modalActions: {
    gap: spacing.sm,
  },
});
