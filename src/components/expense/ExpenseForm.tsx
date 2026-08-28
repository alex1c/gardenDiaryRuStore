/**
 * Expense entry form — amount, category, date, optional relation and notes.
 */

import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { LocalDatePicker } from '@/src/components/date/LocalDatePicker';
import { Button } from '@/src/components/ui/Button';
import { NumericField } from '@/src/components/ui/NumericField';
import { TextField } from '@/src/components/ui/TextField';
import {
  EXPENSE_FORM_CATEGORY_OPTIONS,
  type ExpenseCategory,
} from '@/src/domain/codes';
import type { Expense, GardenArea, PlantCatalogItem, Planting } from '@/src/domain/types';
import { formatTaskRelationLabel } from '@/src/services/taskDisplay';
import { colors, radii, spacing, typography } from '@/src/theme/tokens';
import { finalizePositiveMoneyDraft, formatKopecksForDisplay } from '@/src/utils/money';
import { toLocalDateString } from '@/src/utils/localDate';

export type ExpenseFormValues = {
  amountKopecks: number;
  category: ExpenseCategory;
  date: string;
  areaId: string | null;
  plantingId: string | null;
  notes: string | null;
};

type ExpenseFormProps = {
  areas: GardenArea[];
  plantings: Planting[];
  catalogById: Map<string, PlantCatalogItem>;
  initialAreaId?: string | null;
  initialPlantingId?: string | null;
  initialExpense?: Expense | null;
  submitLabel: string;
  onSubmit: (values: ExpenseFormValues) => void;
  onCancel: () => void;
  onDelete?: () => void;
  saving?: boolean;
};

export function ExpenseForm({
  areas,
  plantings,
  catalogById,
  initialAreaId,
  initialPlantingId,
  initialExpense,
  submitLabel,
  onSubmit,
  onCancel,
  onDelete,
  saving = false,
}: ExpenseFormProps) {
  const today = useMemo(() => toLocalDateString(new Date()), []);

  const [amountDraft, setAmountDraft] = useState(
    initialExpense
      ? String(initialExpense.amountKopecks / 100).replace('.', ',')
      : ''
  );
  const [category, setCategory] = useState<ExpenseCategory>(
    initialExpense?.category ?? 'other'
  );
  const [date, setDate] = useState(initialExpense?.date ?? today);
  const [areaId, setAreaId] = useState<string | null>(
    initialExpense?.areaId ?? initialAreaId ?? null
  );
  const [plantingId, setPlantingId] = useState<string | null>(
    initialExpense?.plantingId ?? initialPlantingId ?? null
  );
  const [showNotes, setShowNotes] = useState(Boolean(initialExpense?.notes));
  const [notes, setNotes] = useState(initialExpense?.notes ?? '');
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

  const relationLabel = formatTaskRelationLabel(
    areaId,
    plantingId,
    areasById,
    plantingsById,
    catalogById
  );

  const handleSubmit = () => {
    setError(null);
    let amountKopecks: number;
    try {
      amountKopecks = finalizePositiveMoneyDraft(amountDraft);
    } catch {
      setError('Укажите корректную сумму');
      return;
    }

    onSubmit({
      amountKopecks,
      category,
      date,
      areaId,
      plantingId,
      notes: notes.trim() || null,
    });
  };

  return (
    <View style={styles.form}>
      <NumericField
        label="Сумма, ₽"
        value={amountDraft}
        onChangeText={setAmountDraft}
        placeholder="890"
        error={error}
      />

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Категория</Text>
        <View style={styles.chips}>
          {EXPENSE_FORM_CATEGORY_OPTIONS.map((option) => (
            <Pressable
              key={option.category}
              accessibilityRole="button"
              onPress={() => setCategory(option.category)}
              style={[
                styles.chip,
                category === option.category ? styles.chipSelected : null,
              ]}
            >
              <Text style={styles.chipLabel}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <LocalDatePicker label="Дата" value={date} onChange={setDate} />

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
              if (!catalog) {
                return null;
              }
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
                  <Text style={styles.chipLabel} numberOfLines={2}>
                    {catalog.varietyName
                      ? `${catalog.speciesName} · ${catalog.varietyName}`
                      : catalog.speciesName}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>

      {showNotes ? (
        <TextField
          label="Комментарий"
          value={notes}
          onChangeText={setNotes}
          placeholder="Например: NPK 16-16-16"
          multiline
        />
      ) : (
        <Pressable accessibilityRole="button" onPress={() => setShowNotes(true)}>
          <Text style={styles.addNotes}>+ Комментарий</Text>
        </Pressable>
      )}

      {initialExpense ? (
        <Text style={styles.preview}>
          Текущая сумма: {formatKopecksForDisplay(initialExpense.amountKopecks)}
        </Text>
      ) : null}

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
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    maxWidth: '100%',
  },
  chipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  chipLabel: {
    ...typography.body,
    color: colors.text,
  },
  addNotes: {
    ...typography.body,
    color: colors.primary,
  },
  preview: {
    ...typography.caption,
    color: colors.textMuted,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
});
