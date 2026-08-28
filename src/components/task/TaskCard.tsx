/**
 * Active task card for the Today screen with complete / postpone / edit actions.
 */

import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import type { GardenArea, GardenTask, PlantCatalogItem, Planting } from '@/src/domain/types';
import {
  formatTaskRelationSubtitle,
  formatTaskTitle,
} from '@/src/services/taskDisplay';
import { colors, spacing, typography } from '@/src/theme/tokens';
import { formatDueDateRelative } from '@/src/utils/dateFormatRu';

type TaskCardProps = {
  task: GardenTask;
  today: string;
  areasById: Map<string, GardenArea>;
  plantingsById: Map<string, Planting>;
  catalogById: Map<string, PlantCatalogItem>;
  onComplete: (taskId: string) => void;
  onPostpone: (taskId: string, newDueDate: string) => void;
  onEdit: (taskId: string) => void;
  showDueLabel?: boolean;
};

export function TaskCard({
  task,
  today,
  areasById,
  plantingsById,
  catalogById,
  onComplete,
  onPostpone,
  onEdit,
  showDueLabel = false,
}: TaskCardProps) {
  const subtitle = formatTaskRelationSubtitle(
    task,
    areasById,
    plantingsById,
    catalogById
  );

  const handlePostpone = () => {
    Alert.alert('Перенести', 'Выберите новую дату', [
      {
        text: 'На завтра',
        onPress: () => onPostpone(task.id, addDays(today, 1)),
      },
      {
        text: '+3 дня',
        onPress: () => onPostpone(task.id, addDays(today, 3)),
      },
      { text: 'Отмена', style: 'cancel' },
    ]);
  };

  const handleOverflow = () => {
    Alert.alert(task.title, undefined, [
      { text: 'Изменить', onPress: () => onEdit(task.id) },
      { text: 'Перенести', onPress: handlePostpone },
      { text: 'Отмена', style: 'cancel' },
    ]);
  };

  return (
    <Card style={styles.card}>
      <Pressable accessibilityRole="button" onPress={() => onEdit(task.id)}>
        <Text style={styles.title}>{formatTaskTitle(task)}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {showDueLabel ? (
          <Text style={styles.due}>{formatDueDateRelative(task.dueDate, today)}</Text>
        ) : null}
      </Pressable>
      <View style={styles.actions}>
        <Button title="✓ Выполнено" onPress={() => onComplete(task.id)} />
        <Button title="Ещё" variant="secondary" onPress={handleOverflow} />
      </View>
    </Card>
  );
}

/** Compact row for tasks completed today. */
export function CompletedTaskRow({
  task,
  onUndo,
}: {
  task: GardenTask;
  onUndo?: (taskId: string) => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onUndo ? () => onUndo(task.id) : undefined}
      style={styles.completedRow}
    >
      <Text style={styles.completedText}>✓ {formatTaskTitle(task)}</Text>
    </Pressable>
  );
}

function addDays(localDate: string, days: number): string {
  const [y, m, d] = localDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
  },
  title: {
    ...typography.subtitle,
    color: colors.text,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  due: {
    ...typography.caption,
    color: colors.warning,
    marginTop: spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  completedRow: {
    paddingVertical: spacing.xs,
  },
  completedText: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
