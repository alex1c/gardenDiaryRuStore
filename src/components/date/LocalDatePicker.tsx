/**
 * Reusable local calendar date picker with Today / Tomorrow shortcuts.
 * Stores canonical YYYY-MM-DD strings; displays Russian-friendly labels.
 */

import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import React, { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '@/src/theme/tokens';
import { formatLocalDateShort } from '@/src/utils/dateFormatRu';
import {
  addDaysToLocalDate,
  parseLocalDate,
  toLocalDateString,
} from '@/src/utils/localDate';

export type DateShortcut = 'today' | 'tomorrow' | 'custom';

type LocalDatePickerProps = {
  label?: string;
  value: string;
  onChange: (localDate: string) => void;
};

export function LocalDatePicker({
  label = 'Когда',
  value,
  onChange,
}: LocalDatePickerProps) {
  const today = useMemo(() => toLocalDateString(new Date()), []);
  const tomorrow = useMemo(() => addDaysToLocalDate(today, 1), [today]);

  const shortcut = useMemo((): DateShortcut => {
    if (value === today) {
      return 'today';
    }
    if (value === tomorrow) {
      return 'tomorrow';
    }
    return 'custom';
  }, [value, today, tomorrow]);

  const [showPicker, setShowPicker] = useState(false);

  const handleShortcut = (next: DateShortcut) => {
    if (next === 'today') {
      onChange(today);
      setShowPicker(false);
      return;
    }
    if (next === 'tomorrow') {
      onChange(tomorrow);
      setShowPicker(false);
      return;
    }
    setShowPicker(true);
  };

  const handlePickerChange = (_event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }
    if (date) {
      onChange(toLocalDateString(date));
    }
  };

  const displayLabel =
    value === today
      ? 'Сегодня'
      : value === tomorrow
        ? 'Завтра'
        : formatLocalDateShort(value);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.chips}>
        <ShortcutChip
          title="Сегодня"
          selected={shortcut === 'today'}
          onPress={() => handleShortcut('today')}
        />
        <ShortcutChip
          title="Завтра"
          selected={shortcut === 'tomorrow'}
          onPress={() => handleShortcut('tomorrow')}
        />
        <ShortcutChip
          title="Выбрать дату"
          selected={shortcut === 'custom'}
          onPress={() => handleShortcut('custom')}
        />
      </View>
      <Text style={styles.display}>{displayLabel}</Text>
      {showPicker ? (
        <DateTimePicker
          value={parseLocalDate(value)}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={handlePickerChange}
        />
      ) : null}
    </View>
  );
}

type ShortcutChipProps = {
  title: string;
  selected: boolean;
  onPress: () => void;
};

function ShortcutChip({ title, selected, onPress }: ShortcutChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.chip, selected ? styles.chipSelected : null]}
    >
      <Text style={[styles.chipLabel, selected ? styles.chipLabelSelected : null]}>
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
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
  display: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
