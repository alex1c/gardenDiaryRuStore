/**
 * Harvest entry form — planting, quantity, unit, date, optional notes.
 */

import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { LocalDatePicker } from '@/src/components/date/LocalDatePicker';
import { Button } from '@/src/components/ui/Button';
import { NumericField } from '@/src/components/ui/NumericField';
import { TextField } from '@/src/components/ui/TextField';
import {
  HARVEST_UNITS,
  HARVEST_UNIT_LABELS,
  type HarvestUnit,
} from '@/src/domain/codes';
import type { Harvest, PlantCatalogItem, Planting } from '@/src/domain/types';
import { formatCatalogLabel } from '@/src/services/plantingDisplay';
import { colors, radii, spacing, typography } from '@/src/theme/tokens';
import { finalizePositiveNumber } from '@/src/utils/numeric';
import { toLocalDateString } from '@/src/utils/localDate';

export type HarvestFormValues = {
  plantingId: string;
  quantity: number;
  unit: HarvestUnit;
  date: string;
  notes: string | null;
};

type HarvestFormProps = {
  plantings: Planting[];
  catalogById: Map<string, PlantCatalogItem>;
  initialPlantingId?: string | null;
  initialHarvest?: Harvest | null;
  submitLabel: string;
  onSubmit: (values: HarvestFormValues) => void;
  onCancel: () => void;
  onDelete?: () => void;
  saving?: boolean;
};

export function HarvestForm({
  plantings,
  catalogById,
  initialPlantingId,
  initialHarvest,
  submitLabel,
  onSubmit,
  onCancel,
  onDelete,
  saving = false,
}: HarvestFormProps) {
  const today = useMemo(() => toLocalDateString(new Date()), []);
  const lockedPlanting = Boolean(initialHarvest || initialPlantingId);

  const [plantingId, setPlantingId] = useState(
    initialHarvest?.plantingId ?? initialPlantingId ?? plantings[0]?.id ?? ''
  );
  const [quantityDraft, setQuantityDraft] = useState(
    initialHarvest ? String(initialHarvest.quantity).replace('.', ',') : ''
  );
  const [unit, setUnit] = useState<HarvestUnit>(initialHarvest?.unit ?? 'kg');
  const [date, setDate] = useState(initialHarvest?.date ?? today);
  const [showNotes, setShowNotes] = useState(Boolean(initialHarvest?.notes));
  const [notes, setNotes] = useState(initialHarvest?.notes ?? '');
  const [error, setError] = useState<string | null>(null);

  const selectedPlanting = plantings.find((p) => p.id === plantingId) ?? null;
  const selectedCatalog = selectedPlanting
    ? catalogById.get(selectedPlanting.catalogItemId) ?? null
    : null;

  const handleSubmit = () => {
    setError(null);
    if (!plantingId) {
      setError('Выберите посадку');
      return;
    }

    let quantity: number;
    try {
      const parsed = finalizePositiveNumber(quantityDraft);
      if (parsed === null) {
        setError('Укажите количество');
        return;
      }
      quantity = parsed;
    } catch {
      setError('Некорректное количество');
      return;
    }

    onSubmit({
      plantingId,
      quantity,
      unit,
      date,
      notes: notes.trim() || null,
    });
  };

  return (
    <View style={styles.form}>
      {lockedPlanting && selectedCatalog ? (
        <View style={styles.plantingLocked}>
          <Text style={styles.label}>Что собрали</Text>
          <Text style={styles.plantingName}>
            {formatCatalogLabel(selectedCatalog)}
          </Text>
        </View>
      ) : (
        <View style={styles.field}>
          <Text style={styles.label}>Посадка</Text>
          <View style={styles.chips}>
            {plantings.map((planting) => {
              const catalog = catalogById.get(planting.catalogItemId);
              if (!catalog) {
                return null;
              }
              const active = planting.id === plantingId;
              return (
                <Pressable
                  key={planting.id}
                  accessibilityRole="button"
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setPlantingId(planting.id)}
                >
                  <Text
                    style={[styles.chipText, active && styles.chipTextActive]}
                    numberOfLines={2}
                  >
                    {formatCatalogLabel(catalog)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      <NumericField
        label="Количество"
        value={quantityDraft}
        onChangeText={setQuantityDraft}
        error={error}
      />

      <View style={styles.field}>
        <Text style={styles.label}>Единица</Text>
        <View style={styles.chips}>
          {HARVEST_UNITS.map((item) => {
            const active = item === unit;
            return (
              <Pressable
                key={item}
                accessibilityRole="button"
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setUnit(item)}
              >
                <Text
                  style={[styles.chipText, active && styles.chipTextActive]}
                >
                  {HARVEST_UNIT_LABELS[item]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <LocalDatePicker label="Дата" value={date} onChange={setDate} />

      {showNotes ? (
        <TextField
          label="Заметка"
          value={notes}
          onChangeText={setNotes}
          multiline
        />
      ) : (
        <Pressable accessibilityRole="button" onPress={() => setShowNotes(true)}>
          <Text style={styles.addNotes}>+ Заметка</Text>
        </Pressable>
      )}

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
  field: {
    gap: spacing.sm,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  plantingLocked: {
    gap: spacing.xs,
  },
  plantingName: {
    ...typography.subtitle,
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
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  chipText: {
    ...typography.body,
    color: colors.text,
  },
  chipTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  addNotes: {
    ...typography.body,
    color: colors.primary,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
});
