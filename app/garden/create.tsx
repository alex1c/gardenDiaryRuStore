/**
 * Create garden form — first-run flow. Creates garden + default season.
 */

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/src/components/ui/Button';
import { Screen } from '@/src/components/ui/Screen';
import { TextField } from '@/src/components/ui/TextField';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import { markMeaningfulActionCompleted } from '@/src/services/ads/adSession';
import { bootstrapGardenWithSeason } from '@/src/services/bootstrapGarden';
import { trackAnalyticsEvent } from '@/src/services/analytics/analytics';
import { ANALYTICS_EVENTS } from '@/src/services/analytics/events';
import { colors, spacing, typography } from '@/src/theme/tokens';

const DEFAULT_NAME = 'Моя дача';

export default function CreateGardenScreen() {
  const router = useRouter();
  const { db, bumpRefresh } = useDatabase();
  const [name, setName] = useState(DEFAULT_NAME);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = () => {
    if (!db) {
      setError('База данных ещё не готова');
      return;
    }

    const trimmed = name.trim();
    if (!trimmed) {
      setError('Укажите название участка');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      bootstrapGardenWithSeason(db, { gardenName: trimmed });
      bumpRefresh();
      trackAnalyticsEvent(ANALYTICS_EVENTS.GARDEN_CREATED);
      markMeaningfulActionCompleted();
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen scroll>
      <Text style={styles.hint}>
        Можно оставить название по умолчанию или изменить его.
      </Text>
      <TextField
        label="Название участка"
        value={name}
        onChangeText={setName}
        error={error}
        autoFocus
        maxLength={80}
      />
      <View style={styles.actions}>
        <Button title="Создать" onPress={handleSave} disabled={saving} />
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
  hint: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  actions: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
});
