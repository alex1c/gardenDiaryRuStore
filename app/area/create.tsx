/**
 * Create garden area form — name + type, persisted to SQLite.
 */

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/src/components/ui/Button';
import { Screen } from '@/src/components/ui/Screen';
import { TextField } from '@/src/components/ui/TextField';
import {
  GARDEN_AREA_TYPES,
  GARDEN_AREA_TYPE_LABELS,
  type GardenAreaType,
} from '@/src/domain/codes';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import { useGardenSnapshot } from '@/src/hooks/useGardenSnapshot';
import { colors, radii, spacing, typography } from '@/src/theme/tokens';

export default function CreateAreaScreen() {
  const router = useRouter();
  const { areaRepository, bumpRefresh } = useDatabase();
  const { garden } = useGardenSnapshot();
  const [name, setName] = useState('');
  const [type, setType] = useState<GardenAreaType>('garden_bed');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = () => {
    if (!areaRepository || !garden) {
      setError('Сначала создайте участок');
      return;
    }

    const trimmed = name.trim();
    if (!trimmed) {
      setError('Укажите название зоны');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      areaRepository.create({
        gardenId: garden.id,
        name: trimmed,
        type,
      });
      bumpRefresh();
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen scroll>
      <TextField
        label="Название"
        value={name}
        onChangeText={setName}
        placeholder="Например, Грядка у дома"
        autoFocus
        maxLength={80}
      />

      <Text style={styles.typeLabel}>Тип</Text>
      <View style={styles.typeList}>
        {GARDEN_AREA_TYPES.map((areaType) => {
          const selected = areaType === type;
          return (
            <Pressable
              key={areaType}
              accessibilityRole="button"
              onPress={() => setType(areaType)}
              style={[styles.typeChip, selected ? styles.typeChipSelected : null]}
            >
              <Text
                style={[
                  styles.typeChipText,
                  selected ? styles.typeChipTextSelected : null,
                ]}
              >
                {GARDEN_AREA_TYPE_LABELS[areaType]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.actions}>
        <Button title="Сохранить" onPress={handleSave} disabled={saving} />
        <Button
          title="Отмена"
          variant="ghost"
          onPress={() => router.back()}
          disabled={saving}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  typeLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  typeList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  typeChip: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: 'center',
  },
  typeChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  typeChipText: {
    ...typography.body,
    color: colors.text,
  },
  typeChipTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  error: {
    ...typography.caption,
    color: colors.error,
    marginTop: spacing.sm,
  },
  actions: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
});
