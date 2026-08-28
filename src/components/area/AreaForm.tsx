/**
 * Shared create/edit form for garden areas.
 */

import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AreaTypePicker } from '@/src/components/area/AreaTypePicker';
import { Button } from '@/src/components/ui/Button';
import { NumericField } from '@/src/components/ui/NumericField';
import { TextField } from '@/src/components/ui/TextField';
import type { GardenAreaType } from '@/src/domain/codes';
import type { GardenArea } from '@/src/domain/types';
import { colors, spacing, typography } from '@/src/theme/tokens';
import {
  finalizePositiveNumber,
  formatDecimalForDisplay,
} from '@/src/utils/numeric';

export type AreaFormValues = {
  name: string;
  type: GardenAreaType;
  length: number | null;
  width: number | null;
  notes: string | null;
};

type AreaFormProps = {
  initial?: GardenArea | null;
  submitLabel: string;
  onSubmit: (values: AreaFormValues) => void;
  onCancel: () => void;
  saving?: boolean;
};

export function AreaForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  saving = false,
}: AreaFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState<GardenAreaType>(initial?.type ?? 'garden_bed');
  const [lengthDraft, setLengthDraft] = useState(
    initial?.length != null ? formatDecimalForDisplay(initial.length) : ''
  );
  const [widthDraft, setWidthDraft] = useState(
    initial?.width != null ? formatDecimalForDisplay(initial.width) : ''
  );
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Укажите название зоны');
      return;
    }

    try {
      const length = finalizePositiveNumber(lengthDraft);
      const width = finalizePositiveNumber(widthDraft);
      setError(null);
      onSubmit({
        name: trimmedName,
        type,
        length,
        width,
        notes: notes.trim() || null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <View style={styles.form}>
      <TextField
        label="Название"
        value={name}
        onChangeText={setName}
        placeholder="Например, Грядка 1"
        maxLength={80}
      />

      <AreaTypePicker value={type} onChange={setType} />

      <Text style={styles.section}>Размеры (необязательно)</Text>
      <View style={styles.row}>
        <View style={styles.half}>
          <NumericField
            label="Длина, м"
            value={lengthDraft}
            onChangeText={setLengthDraft}
            placeholder="6,0"
          />
        </View>
        <View style={styles.half}>
          <NumericField
            label="Ширина, м"
            value={widthDraft}
            onChangeText={setWidthDraft}
            placeholder="1,0"
          />
        </View>
      </View>

      <TextField
        label="Заметка"
        value={notes}
        onChangeText={setNotes}
        placeholder="Необязательно"
        multiline
        numberOfLines={3}
        style={styles.notes}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.actions}>
        <Button title={submitLabel} onPress={handleSubmit} disabled={saving} />
        <Button title="Отмена" variant="ghost" onPress={onCancel} disabled={saving} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.sm,
  },
  section: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
    marginTop: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  half: {
    flex: 1,
    minWidth: 0,
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

export default AreaForm;
