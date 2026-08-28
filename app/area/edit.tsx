/**
 * Edit garden area.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AreaForm, type AreaFormValues } from '@/src/components/area/AreaForm';
import { Screen } from '@/src/components/ui/Screen';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import { colors, typography } from '@/src/theme/tokens';

export default function EditAreaScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { areaRepository, bumpRefresh, ready } = useDatabase();
  const [saving, setSaving] = useState(false);

  const area = useMemo(() => {
    if (!ready || !areaRepository || !id) {
      return null;
    }
    return areaRepository.getById(id);
  }, [ready, areaRepository, id]);

  if (!ready || !area) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          {!area && ready ? (
            <Text style={styles.missing}>Зона не найдена</Text>
          ) : null}
        </View>
      </Screen>
    );
  }

  const handleSubmit = (values: AreaFormValues) => {
    if (!areaRepository) {
      return;
    }

    setSaving(true);
    try {
      areaRepository.update(area.id, {
        name: values.name,
        type: values.type,
        length: values.length,
        width: values.width,
        notes: values.notes,
      });
      bumpRefresh();
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen scroll keyboardShouldPersistTaps="handled">
      <AreaForm
        initial={area}
        submitLabel="Сохранить изменения"
        onSubmit={handleSubmit}
        onCancel={() => router.back()}
        saving={saving}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  missing: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
