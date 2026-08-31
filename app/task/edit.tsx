/**
 * Edit or delete an existing garden task.
 *
 * Recurring tasks edit the current occurrence/rule; the next due date after
 * completion is computed from the updated repeat settings and scheduled dueDate.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';

import { TaskForm, type TaskFormValues } from '@/src/components/task/TaskForm';
import { Screen } from '@/src/components/ui/Screen';
import { useGardenSnapshot } from '@/src/hooks/useGardenSnapshot';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import { syncDailyReminder } from '@/src/services/notificationScheduler';
import { colors, spacing, typography } from '@/src/theme/tokens';

export default function EditTaskScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { bumpRefresh, taskRepository, settingsRepository } = useDatabase();
  const { loading, areas, plantings, catalogById } = useGardenSnapshot();
  const [saving, setSaving] = useState(false);

  const task = useMemo(() => {
    if (!taskRepository || !id) {
      return null;
    }
    return taskRepository.getById(id);
  }, [taskRepository, id]);

  const handleSubmit = async (values: TaskFormValues) => {
    if (!taskRepository || !task || !settingsRepository) {
      return;
    }

    setSaving(true);
    try {
      taskRepository.update(task.id, {
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
      await syncDailyReminder(settingsRepository.getSettings());
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!taskRepository || !task || !settingsRepository) {
      return;
    }

    Alert.alert('Удалить дело?', task.title, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          taskRepository.delete(task.id);
          bumpRefresh();
          await syncDailyReminder(settingsRepository.getSettings());
          router.back();
        },
      },
    ]);
  };

  if (loading || !task) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (task.completedAt !== null) {
    return (
      <Screen>
        <Text style={styles.heading}>Дело выполнено</Text>
        <Text style={styles.body}>
          Выполненные дела нельзя редактировать. Отмените выполнение на экране
          «Сегодня», если нужно исправить.
        </Text>
      </Screen>
    );
  }

  return (
    <Screen scroll keyboardAvoiding keyboardShouldPersistTaps="handled">
      <Text style={styles.heading}>Изменить дело</Text>
      <TaskForm
        areas={areas}
        plantings={plantings}
        catalogById={catalogById}
        initialTask={task}
        submitLabel="Сохранить"
        saving={saving}
        onSubmit={handleSubmit}
        onCancel={() => router.back()}
        onDelete={handleDelete}
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
    marginBottom: spacing.md,
  },
  body: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
