/**
 * Reusable area type chip picker.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  GARDEN_AREA_TYPES,
  GARDEN_AREA_TYPE_LABELS,
  type GardenAreaType,
} from '@/src/domain/codes';
import { colors, radii, spacing, typography } from '@/src/theme/tokens';

type AreaTypePickerProps = {
  value: GardenAreaType;
  onChange: (type: GardenAreaType) => void;
};

export function AreaTypePicker({ value, onChange }: AreaTypePickerProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Тип</Text>
      <View style={styles.list}>
        {GARDEN_AREA_TYPES.map((areaType) => {
          const selected = areaType === value;
          return (
            <Pressable
              key={areaType}
              accessibilityRole="button"
              onPress={() => onChange(areaType)}
              style={[styles.chip, selected ? styles.chipSelected : null]}
            >
              <Text style={[styles.chipText, selected ? styles.chipTextSelected : null]}>
                {GARDEN_AREA_TYPE_LABELS[areaType]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  list: {
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
  },
  chipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  chipText: {
    ...typography.body,
    color: colors.text,
  },
  chipTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
});

export default AreaTypePicker;
