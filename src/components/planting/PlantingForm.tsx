/**
 * Shared create/edit/copy form for plantings.
 */

import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { Button } from '@/src/components/ui/Button';
import { NumericField } from '@/src/components/ui/NumericField';
import { TextField } from '@/src/components/ui/TextField';
import {
  PLANTING_STATUSES,
  PLANTING_STATUS_LABELS,
  QUANTITY_UNITS,
  QUANTITY_UNIT_LABELS,
  type PlantingStatus,
  type QuantityUnit,
} from '@/src/domain/codes';
import type { GardenArea, PlantCatalogItem, Planting } from '@/src/domain/types';
import {
  defaultPlantingStatus,
  formatCatalogLabel,
} from '@/src/services/plantingDisplay';
import { colors, radii, spacing, typography } from '@/src/theme/tokens';
import { isValidLocalDateString } from '@/src/utils/localDate';
import {
  finalizePositiveNumber,
  formatDecimalForDisplay,
} from '@/src/utils/numeric';

export type PlantingFormValues = {
  speciesName: string;
  varietyName: string | null;
  areaId: string | null;
  quantity: number | null;
  quantityUnit: QuantityUnit | null;
  status: PlantingStatus;
  sowingDate: string | null;
  transplantDate: string | null;
  notes: string | null;
  preferredCatalogItemId: string | null;
  /** When true, creates a garden-level plant identity spanning seasons. */
  isPerennial: boolean;
};

type PlantingFormProps = {
  areas: GardenArea[];
  catalogItems: PlantCatalogItem[];
  initialAreaId?: string | null;
  initialPlanting?: Planting | null;
  initialCatalog?: PlantCatalogItem | null;
  /** Initial perennial toggle (edit mode when gardenPlantId is set). */
  initialIsPerennial?: boolean;
  submitLabel: string;
  onSubmit: (values: PlantingFormValues) => void;
  onCancel: () => void;
  onDelete?: () => void;
  saving?: boolean;
};

export function PlantingForm({
  areas,
  catalogItems,
  initialAreaId,
  initialPlanting,
  initialCatalog,
  initialIsPerennial = false,
  submitLabel,
  onSubmit,
  onCancel,
  onDelete,
  saving = false,
}: PlantingFormProps) {
  const [speciesName, setSpeciesName] = useState(initialCatalog?.speciesName ?? '');
  const [varietyName, setVarietyName] = useState(initialCatalog?.varietyName ?? '');
  const [areaId, setAreaId] = useState<string | null>(
    initialPlanting?.areaId ?? initialAreaId ?? areas[0]?.id ?? null
  );
  const [quantityDraft, setQuantityDraft] = useState(
    initialPlanting?.quantity != null
      ? formatDecimalForDisplay(initialPlanting.quantity)
      : ''
  );
  const [quantityUnit, setQuantityUnit] = useState<QuantityUnit | null>(
    initialPlanting?.quantityUnit ?? null
  );
  const [status, setStatus] = useState<PlantingStatus>(
    initialPlanting?.status ?? defaultPlantingStatus()
  );
  const [showExtra, setShowExtra] = useState(
    Boolean(
      initialPlanting?.sowingDate ||
        initialPlanting?.transplantDate ||
        initialPlanting?.notes
    )
  );
  const [sowingDate, setSowingDate] = useState(initialPlanting?.sowingDate ?? '');
  const [transplantDate, setTransplantDate] = useState(
    initialPlanting?.transplantDate ?? ''
  );
  const [notes, setNotes] = useState(initialPlanting?.notes ?? '');
  const [selectedCatalogId, setSelectedCatalogId] = useState<string | null>(
    initialCatalog?.id ?? null
  );
  const [isPerennial, setIsPerennial] = useState(
    initialIsPerennial || Boolean(initialPlanting?.gardenPlantId)
  );
  const [error, setError] = useState<string | null>(null);

  const suggestions = useMemo(() => {
    const query = speciesName.trim().toLowerCase();
    if (!query) {
      return catalogItems.slice(0, 8);
    }
    return catalogItems
      .filter((item) => item.speciesName.toLowerCase().includes(query))
      .slice(0, 8);
  }, [catalogItems, speciesName]);

  const handleSelectCatalog = (item: PlantCatalogItem) => {
    setSpeciesName(item.speciesName);
    setVarietyName(item.varietyName ?? '');
    setSelectedCatalogId(item.id);
  };

  const handleSpeciesChange = (text: string) => {
    setSpeciesName(text);
    setSelectedCatalogId(null);
  };

  const handleVarietyChange = (text: string) => {
    setVarietyName(text);
    setSelectedCatalogId(null);
  };

  const handleSubmit = () => {
    const species = speciesName.trim();
    if (!species) {
      setError('Укажите культуру');
      return;
    }

    try {
      let quantity: number | null = null;
      if (quantityDraft.trim()) {
        quantity = finalizePositiveNumber(quantityDraft);
        if (quantity !== null && !quantityUnit) {
          setError('Выберите единицу количества');
          return;
        }
      }

      const sowing = sowingDate.trim() || null;
      const transplant = transplantDate.trim() || null;
      if (sowing && !isValidLocalDateString(sowing)) {
        setError('Неверная дата посева (ГГГГ-ММ-ДД)');
        return;
      }
      if (transplant && !isValidLocalDateString(transplant)) {
        setError('Неверная дата высадки (ГГГГ-ММ-ДД)');
        return;
      }

      setError(null);
      onSubmit({
        speciesName: species,
        varietyName: varietyName.trim() || null,
        areaId,
        quantity,
        quantityUnit: quantity ? quantityUnit : null,
        status,
        sowingDate: sowing,
        transplantDate: transplant,
        notes: notes.trim() || null,
        preferredCatalogItemId: selectedCatalogId,
        isPerennial,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <View style={styles.form}>
      <TextField
        label="Культура"
        value={speciesName}
        onChangeText={handleSpeciesChange}
        placeholder="Например, Томат"
        maxLength={80}
      />

      {suggestions.length > 0 ? (
        <View style={styles.suggestions}>
          <Text style={styles.suggestLabel}>Уже на участке</Text>
          <View style={styles.suggestList}>
            {suggestions.map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                onPress={() => handleSelectCatalog(item)}
                style={[
                  styles.suggestChip,
                  selectedCatalogId === item.id ? styles.suggestChipSelected : null,
                ]}
              >
                <Text
                  style={styles.suggestText}
                  numberOfLines={2}
                >
                  {formatCatalogLabel(item)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <TextField
        label="Сорт"
        value={varietyName}
        onChangeText={handleVarietyChange}
        placeholder="Необязательно"
        maxLength={80}
      />

      <Text style={styles.sectionLabel}>Место</Text>
      <View style={styles.chipRow}>
        {areas.map((area) => {
          const selected = area.id === areaId;
          return (
            <Pressable
              key={area.id}
              accessibilityRole="button"
              onPress={() => setAreaId(area.id)}
              style={[styles.chip, selected ? styles.chipSelected : null]}
            >
              <Text
                style={[styles.chipText, selected ? styles.chipTextSelected : null]}
                numberOfLines={2}
              >
                {area.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <NumericField
        label="Количество"
        value={quantityDraft}
        onChangeText={setQuantityDraft}
        placeholder="Необязательно"
      />

      {quantityDraft.trim() ? (
        <>
          <Text style={styles.sectionLabel}>Единица</Text>
          <View style={styles.chipRow}>
            {QUANTITY_UNITS.filter((u) => u !== 'other').map((unit) => {
              const selected = unit === quantityUnit;
              return (
                <Pressable
                  key={unit}
                  accessibilityRole="button"
                  onPress={() => setQuantityUnit(unit)}
                  style={[styles.chip, selected ? styles.chipSelected : null]}
                >
                  <Text
                    style={[styles.chipText, selected ? styles.chipTextSelected : null]}
                  >
                    {QUANTITY_UNIT_LABELS[unit]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}

      <View style={styles.perennialRow}>
        <View style={styles.perennialText}>
          <Text style={styles.sectionLabel}>Многолетнее растение</Text>
          <Text style={styles.perennialHint}>
            Сохранится для следующих сезонов (яблоня, смородина, клубника).
          </Text>
        </View>
        <Switch
          value={isPerennial}
          onValueChange={setIsPerennial}
          disabled={Boolean(initialPlanting?.gardenPlantId)}
        />
      </View>

      <Text style={styles.sectionLabel}>Статус</Text>
      <View style={styles.chipRow}>
        {PLANTING_STATUSES.map((value) => {
          const selected = value === status;
          return (
            <Pressable
              key={value}
              accessibilityRole="button"
              onPress={() => setStatus(value)}
              style={[styles.chip, selected ? styles.chipSelected : null]}
            >
              <Text style={[styles.chipText, selected ? styles.chipTextSelected : null]}>
                {PLANTING_STATUS_LABELS[value]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => setShowExtra((v) => !v)}
        style={styles.extraToggle}
      >
        <Text style={styles.extraToggleText}>
          {showExtra ? 'Скрыть дополнительно' : 'Дополнительно'}
        </Text>
      </Pressable>

      {showExtra ? (
        <View style={styles.extraBlock}>
          <TextField
            label="Дата посева"
            value={sowingDate}
            onChangeText={setSowingDate}
            placeholder="ГГГГ-ММ-ДД"
          />
          <TextField
            label="Дата высадки"
            value={transplantDate}
            onChangeText={setTransplantDate}
            placeholder="ГГГГ-ММ-ДД"
          />
          <TextField
            label="Заметка"
            value={notes}
            onChangeText={setNotes}
            placeholder="Необязательно"
            multiline
            numberOfLines={3}
            style={styles.notes}
          />
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.actions}>
        <Button title={submitLabel} onPress={handleSubmit} disabled={saving} />
        {onDelete ? (
          <Button title="Удалить посадку" variant="secondary" onPress={onDelete} disabled={saving} />
        ) : null}
        <Button title="Отмена" variant="ghost" onPress={onCancel} disabled={saving} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.sm,
  },
  sectionLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
    marginTop: spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    maxWidth: '100%',
  },
  chipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  chipText: {
    ...typography.body,
    color: colors.text,
    flexShrink: 1,
  },
  chipTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  suggestions: {
    gap: spacing.xs,
  },
  suggestLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  suggestList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  suggestChip: {
    maxWidth: '100%',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceMuted,
  },
  suggestChipSelected: {
    backgroundColor: colors.primarySoft,
  },
  suggestText: {
    ...typography.caption,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  extraToggle: {
    minHeight: 44,
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  extraToggleText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
  extraBlock: {
    gap: spacing.sm,
  },
  perennialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  perennialText: {
    flex: 1,
    gap: spacing.xs,
  },
  perennialHint: {
    ...typography.caption,
    color: colors.textMuted,
  },
  notes: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  error: {
    ...typography.caption,
    color: colors.error,
  },
  actions: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
});

export default PlantingForm;
