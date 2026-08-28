/**
 * Manual diary entry form — title, date, type, relation, optional notes/photos.
 */

import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { LocalDatePicker } from '@/src/components/date/LocalDatePicker';
import { Button } from '@/src/components/ui/Button';
import { TextField } from '@/src/components/ui/TextField';
import {
  DIARY_FORM_TYPE_OPTIONS,
  type WorkType,
} from '@/src/domain/codes';
import type { GardenArea, GardenEvent, PlantCatalogItem, Planting } from '@/src/domain/types';
import { formatTaskRelationLabel } from '@/src/services/taskDisplay';
import { colors, radii, spacing, typography } from '@/src/theme/tokens';
import { toLocalDateString } from '@/src/utils/localDate';

export type EventFormValues = {
  title: string;
  type: WorkType;
  eventDate: string;
  areaId: string | null;
  plantingId: string | null;
  notes: string | null;
};

type EventFormProps = {
  areas: GardenArea[];
  plantings: Planting[];
  catalogById: Map<string, PlantCatalogItem>;
  initialAreaId?: string | null;
  initialPlantingId?: string | null;
  initialEvent?: GardenEvent | null;
  submitLabel: string;
  onSubmit: (values: EventFormValues) => void;
  onCancel: () => void;
  onDelete?: () => void;
  saving?: boolean;
  readOnly?: boolean;
  extraActions?: React.ReactNode;
};

export function EventForm({
  areas,
  plantings,
  catalogById,
  initialAreaId,
  initialPlantingId,
  initialEvent,
  submitLabel,
  onSubmit,
  onCancel,
  onDelete,
  saving = false,
  readOnly = false,
  extraActions,
}: EventFormProps) {
  const today = useMemo(() => toLocalDateString(new Date()), []);

  const [title, setTitle] = useState(initialEvent?.title ?? '');
  const [type, setType] = useState<WorkType>(initialEvent?.type ?? 'observation');
  const [eventDate, setEventDate] = useState(initialEvent?.eventDate ?? today);
  const [areaId, setAreaId] = useState<string | null>(
    initialEvent?.areaId ?? initialAreaId ?? null
  );
  const [plantingId, setPlantingId] = useState<string | null>(
    initialEvent?.plantingId ?? initialPlantingId ?? null
  );
  const [showExtra, setShowExtra] = useState(Boolean(initialEvent?.notes));
  const [notes, setNotes] = useState(initialEvent?.notes ?? '');
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
      setError('Укажите, что произошло');
      return;
    }
    setError(null);
    onSubmit({
      title: trimmed,
      type,
      eventDate,
      areaId,
      plantingId,
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

  if (readOnly && initialEvent) {
    return (
      <View style={styles.form}>
        <Text style={styles.readOnlyTitle}>{initialEvent.title}</Text>
        {initialEvent.notes ? (
          <Text style={styles.readOnlyBody}>{initialEvent.notes}</Text>
        ) : null}
        <Text style={styles.readOnlyHint}>
          Эта запись создана автоматически при выполнении дела. Изменить можно
          через «Отменить» на экране «Сегодня», пока это доступно.
        </Text>
        <Button title="Закрыть" variant="secondary" onPress={onCancel} />
      </View>
    );
  }

  return (
    <View style={styles.form}>
      <TextField
        label="Что произошло"
        value={title}
        onChangeText={setTitle}
        placeholder="Например: появились первые цветы"
      />

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Тип записи</Text>
        <View style={styles.chips}>
          {DIARY_FORM_TYPE_OPTIONS.map((option, index) => (
            <Pressable
              key={`${option.type}-${option.label}-${index}`}
              accessibilityRole="button"
              onPress={() => setType(option.type)}
              style={[styles.chip, type === option.type ? styles.chipSelected : null]}
            >
              <Text style={styles.chipLabel}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <LocalDatePicker label="Дата" value={eventDate} onChange={setEventDate} />

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

      {extraActions}

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
  readOnlyTitle: {
    ...typography.subtitle,
    color: colors.text,
  },
  readOnlyBody: {
    ...typography.body,
    color: colors.textSecondary,
  },
  readOnlyHint: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
