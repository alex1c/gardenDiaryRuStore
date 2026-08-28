/**
 * Shared create/edit form for garden tasks.
 */

import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { LocalDatePicker } from '@/src/components/date/LocalDatePicker';
import { Button } from '@/src/components/ui/Button';
import { NumericField } from '@/src/components/ui/NumericField';
import { TextField } from '@/src/components/ui/TextField';
import {
  REPEAT_TYPES,
  REPEAT_TYPE_LABELS,
  WORK_TYPES,
  WORK_TYPE_LABELS,
  type RepeatType,
  type WorkType,
} from '@/src/domain/codes';
import type { GardenArea, GardenTask, PlantCatalogItem, Planting } from '@/src/domain/types';
import { formatTaskRelationLabel } from '@/src/services/taskDisplay';
import { colors, radii, spacing, typography } from '@/src/theme/tokens';
import { toLocalDateString } from '@/src/utils/localDate';
import { finalizePositiveNumber } from '@/src/utils/numeric';

export type TaskFormValues = {
  title: string;
  type: WorkType;
  dueDate: string;
  areaId: string | null;
  plantingId: string | null;
  repeatType: RepeatType;
  repeatInterval: number | null;
  notes: string | null;
};

type TaskFormProps = {
  areas: GardenArea[];
  plantings: Planting[];
  catalogById: Map<string, PlantCatalogItem>;
  initialAreaId?: string | null;
  initialPlantingId?: string | null;
  initialTask?: GardenTask | null;
  submitLabel: string;
  onSubmit: (values: TaskFormValues) => void;
  onCancel: () => void;
  onDelete?: () => void;
  saving?: boolean;
};

export function TaskForm({
  areas,
  plantings,
  catalogById,
  initialAreaId,
  initialPlantingId,
  initialTask,
  submitLabel,
  onSubmit,
  onCancel,
  onDelete,
  saving = false,
}: TaskFormProps) {
  const today = useMemo(() => toLocalDateString(new Date()), []);

  const [title, setTitle] = useState(initialTask?.title ?? '');
  const [type, setType] = useState<WorkType>(initialTask?.type ?? 'other');
  const [dueDate, setDueDate] = useState(initialTask?.dueDate ?? today);
  const [areaId, setAreaId] = useState<string | null>(
    initialTask?.areaId ?? initialAreaId ?? null
  );
  const [plantingId, setPlantingId] = useState<string | null>(
    initialTask?.plantingId ?? initialPlantingId ?? null
  );
  const [repeatType, setRepeatType] = useState<RepeatType>(
    initialTask?.repeatType ?? 'none'
  );
  const [repeatIntervalDraft, setRepeatIntervalDraft] = useState(
    initialTask?.repeatInterval != null ? String(initialTask.repeatInterval) : '2'
  );
  const [showExtra, setShowExtra] = useState(Boolean(initialTask?.notes));
  const [notes, setNotes] = useState(initialTask?.notes ?? '');
  const [error, setError] = useState<string | null>(null);

  const areasById = useMemo(
    () => new Map(areas.map((area) => [area.id, area])),
    [areas]
  );
  const plantingsById = useMemo(
    () => new Map(plantings.map((p) => [p.id, p])),
    [plantings]
  );

  const plantingsForArea = useMemo(() => {
    if (!areaId) {
      return plantings;
    }
    return plantings.filter((p) => p.areaId === areaId);
  }, [plantings, areaId]);

  const handleSubmit = () => {
    const trimmed = title.trim();
    if (trimmed.length === 0) {
      setError('Укажите, что нужно сделать');
      return;
    }

    let repeatInterval: number | null = null;
    if (repeatType === 'every_n_days') {
      const parsed = finalizePositiveNumber(repeatIntervalDraft);
      if (parsed === null || !Number.isInteger(parsed) || parsed < 1) {
        setError('Укажите интервал повторения (целое число ≥ 1)');
        return;
      }
      repeatInterval = parsed;
    }

    setError(null);
    onSubmit({
      title: trimmed,
      type,
      dueDate,
      areaId,
      plantingId,
      repeatType,
      repeatInterval,
      notes: notes.trim().length > 0 ? notes.trim() : null,
    });
  };

  const relationLabel = formatTaskRelationLabel(
    areaId,
    plantingId,
    areasById,
    plantingsById,
    catalogById
  );

  return (
    <View style={styles.form}>
      <TextField
        label="Что сделать"
        value={title}
        onChangeText={setTitle}
        placeholder="Например: полить теплицу"
        autoFocus
      />

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Тип</Text>
        <View style={styles.chips}>
          {WORK_TYPES.map((workType) => (
            <Pressable
              key={workType}
              accessibilityRole="button"
              onPress={() => setType(workType)}
              style={[styles.chip, type === workType ? styles.chipSelected : null]}
            >
              <Text
                style={[
                  styles.chipLabel,
                  type === workType ? styles.chipLabelSelected : null,
                ]}
              >
                {WORK_TYPE_LABELS[workType]}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <LocalDatePicker value={dueDate} onChange={setDueDate} />

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Относится к</Text>
        <Text style={styles.relationValue}>{relationLabel}</Text>
        <View style={styles.chips}>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setAreaId(null);
              setPlantingId(null);
            }}
            style={[
              styles.chip,
              areaId === null && plantingId === null ? styles.chipSelected : null,
            ]}
          >
            <Text style={styles.chipLabel}>Весь участок</Text>
          </Pressable>
          {areas.map((area) => (
            <Pressable
              key={area.id}
              accessibilityRole="button"
              onPress={() => {
                setAreaId(area.id);
                if (plantingId) {
                  const planting = plantingsById.get(plantingId);
                  if (planting?.areaId !== area.id) {
                    setPlantingId(null);
                  }
                }
              }}
              style={[
                styles.chip,
                areaId === area.id && plantingId === null ? styles.chipSelected : null,
              ]}
            >
              <Text style={styles.chipLabel}>{area.name}</Text>
            </Pressable>
          ))}
        </View>
        {plantingsForArea.length > 0 ? (
          <View style={styles.chips}>
            {plantingsForArea.map((planting) => {
              const catalog = catalogById.get(planting.catalogItemId);
              const label = catalog
                ? catalog.varietyName ?? catalog.speciesName
                : 'Посадка';
              return (
                <Pressable
                  key={planting.id}
                  accessibilityRole="button"
                  onPress={() => {
                    setPlantingId(planting.id);
                    if (planting.areaId) {
                      setAreaId(planting.areaId);
                    }
                  }}
                  style={[
                    styles.chip,
                    plantingId === planting.id ? styles.chipSelected : null,
                  ]}
                >
                  <Text style={styles.chipLabel}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Повтор</Text>
        <View style={styles.chips}>
          {REPEAT_TYPES.map((option) => (
            <Pressable
              key={option}
              accessibilityRole="button"
              onPress={() => setRepeatType(option)}
              style={[
                styles.chip,
                repeatType === option ? styles.chipSelected : null,
              ]}
            >
              <Text style={styles.chipLabel}>{REPEAT_TYPE_LABELS[option]}</Text>
            </Pressable>
          ))}
        </View>
        {repeatType === 'every_n_days' ? (
          <NumericField
            label="Каждые N дней"
            value={repeatIntervalDraft}
            onChangeText={setRepeatIntervalDraft}
          />
        ) : null}
      </View>

      {!showExtra ? (
        <Pressable accessibilityRole="button" onPress={() => setShowExtra(true)}>
          <Text style={styles.extraToggle}>Дополнительно</Text>
        </Pressable>
      ) : (
        <TextField
          label="Заметка"
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
        />
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.actions}>
        <Button title={submitLabel} onPress={handleSubmit} disabled={saving} />
        <Button title="Отмена" variant="secondary" onPress={onCancel} />
        {onDelete ? (
          <Button title="Удалить" variant="ghost" onPress={onDelete} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.md,
  },
  section: {
    gap: spacing.sm,
  },
  sectionLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  relationValue: {
    ...typography.body,
    color: colors.text,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    minHeight: 44,
    justifyContent: 'center',
  },
  chipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  chipLabel: {
    ...typography.body,
    color: colors.text,
  },
  chipLabelSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  extraToggle: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
  error: {
    ...typography.caption,
    color: colors.error,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});
