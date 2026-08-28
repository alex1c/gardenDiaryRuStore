/**
 * Destructive restore confirmation with backup summary counts.
 */

import { Modal, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/src/components/ui/Button';
import type { BackupPreview } from '@/src/services/backup/backupTypes';
import { colors, spacing, typography } from '@/src/theme/tokens';
import { formatLocalDateLong } from '@/src/utils/dateFormatRu';

type RestorePreviewModalProps = {
  visible: boolean;
  preview: BackupPreview | null;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function RestorePreviewModal({
  visible,
  preview,
  busy = false,
  onConfirm,
  onCancel,
}: RestorePreviewModalProps) {
  if (!preview) {
    return null;
  }

  const createdLabel = formatLocalDateLong(preview.createdAt.slice(0, 10));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Резервная копия</Text>
          <Text style={styles.date}>{createdLabel}</Text>

          <View style={styles.stats}>
            <Text style={styles.line}>Участков: {preview.gardenCount}</Text>
            <Text style={styles.line}>Сезонов: {preview.seasonCount}</Text>
            <Text style={styles.line}>Зон: {preview.areaCount}</Text>
            <Text style={styles.line}>Посадок: {preview.plantingCount}</Text>
            <Text style={styles.line}>Задач: {preview.taskCount}</Text>
            <Text style={styles.line}>Записей: {preview.eventCount}</Text>
            <Text style={styles.line}>Урожаев: {preview.harvestCount}</Text>
            <Text style={styles.line}>Расходов: {preview.expenseCount}</Text>
            <Text style={styles.line}>Фото: {preview.photoCount}</Text>
          </View>

          <Text style={styles.warning}>
            Текущие данные приложения будут заменены данными из резервной копии.
          </Text>

          <View style={styles.actions}>
            <Button title="Восстановить" onPress={onConfirm} disabled={busy} />
            <Button title="Отмена" variant="secondary" onPress={onCancel} disabled={busy} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    ...typography.subtitle,
    color: colors.text,
  },
  date: {
    ...typography.body,
    color: colors.textSecondary,
  },
  stats: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  line: {
    ...typography.body,
    color: colors.text,
  },
  warning: {
    ...typography.body,
    color: colors.error,
    marginTop: spacing.md,
  },
  actions: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
});
