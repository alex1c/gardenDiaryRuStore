/**
 * Create season wizard — year, title, empty or based on previous season.
 */

import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import { Button } from '@/src/components/ui/Button';
import { Screen } from '@/src/components/ui/Screen';
import { TextField } from '@/src/components/ui/TextField';
import { useGardenSnapshot } from '@/src/hooks/useGardenSnapshot';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import { useSeasonContext } from '@/src/providers/SeasonProvider';
import { createSeasonWithOptions } from '@/src/services/seasonCloneService';
import { colors, radii, spacing, typography } from '@/src/theme/tokens';

type StartMode = 'empty' | 'fromPrevious';

export default function CreateSeasonScreen() {
  const router = useRouter();
  const { db, bumpRefresh, seasonRepository } = useDatabase();
  const { garden, activeSeason, loading } = useGardenSnapshot();
  const { setActiveSeasonId } = useSeasonContext();

  const defaultYear = (activeSeason?.year ?? new Date().getFullYear()) + 1;
  const [yearText, setYearText] = useState(String(defaultYear));
  const [title, setTitle] = useState(`Сезон ${defaultYear}`);
  const [startMode, setStartMode] = useState<StartMode>(
    activeSeason ? 'fromPrevious' : 'empty'
  );
  const [copyPerennials, setCopyPerennials] = useState(true);
  const [copyAnnuals, setCopyAnnuals] = useState(false);
  const [setAsActive, setSetAsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const sourceSeason = activeSeason;

  const year = useMemo(() => parseInt(yearText, 10), [yearText]);

  const handleYearChange = (text: string) => {
    setYearText(text);
    const parsed = parseInt(text, 10);
    if (Number.isInteger(parsed)) {
      setTitle(`Сезон ${parsed}`);
    }
  };

  const handleSubmit = () => {
    if (!db || !garden) {
      return;
    }
    if (!Number.isInteger(year) || year < 1900 || year > 2200) {
      setError('Укажите корректный год');
      return;
    }
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Укажите название сезона');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const result = createSeasonWithOptions(db, {
        gardenId: garden.id,
        year,
        title: trimmedTitle,
        sourceSeasonId:
          startMode === 'fromPrevious' && sourceSeason ? sourceSeason.id : null,
        copyPerennials: startMode === 'fromPrevious' && copyPerennials,
        copyAnnualPlantings: startMode === 'fromPrevious' && copyAnnuals,
        setActive: setAsActive,
      });

      if (setAsActive) {
        setActiveSeasonId(result.season.id);
      }
      bumpRefresh();
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading || !garden) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  const duplicateExists = seasonRepository?.getByGardenAndYear(garden.id, year);

  return (
    <Screen scroll keyboardShouldPersistTaps="handled">
      <TextField
        label="Год"
        value={yearText}
        onChangeText={handleYearChange}
        keyboardType="number-pad"
        maxLength={4}
      />
      <TextField
        label="Название"
        value={title}
        onChangeText={setTitle}
        maxLength={80}
      />

      {duplicateExists ? (
        <Text style={styles.warn}>
          Сезон для {year} года уже существует
        </Text>
      ) : null}

      <Text style={styles.sectionLabel}>Как начать?</Text>
      <View style={styles.modeRow}>
        <Pressable
          accessibilityRole="button"
          onPress={() => setStartMode('empty')}
          style={[styles.modeChip, startMode === 'empty' ? styles.modeSelected : null]}
        >
          <Text style={styles.modeText}>Пустой сезон</Text>
        </Pressable>
        {sourceSeason ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => setStartMode('fromPrevious')}
            style={[
              styles.modeChip,
              startMode === 'fromPrevious' ? styles.modeSelected : null,
            ]}
          >
            <Text style={styles.modeText}>
              На основе {sourceSeason.title}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {startMode === 'fromPrevious' && sourceSeason ? (
        <View style={styles.checklist}>
          <Text style={styles.hint}>
            Зоны участка и каталог культур доступны во всех сезонах автоматически.
          </Text>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Перенести многолетники</Text>
            <Switch value={copyPerennials} onValueChange={setCopyPerennials} />
          </View>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Скопировать активные посадки</Text>
            <Switch value={copyAnnuals} onValueChange={setCopyAnnuals} />
          </View>
          <Text style={styles.hint}>
            Урожай, расходы, задачи, записи и фото не копируются.
          </Text>
        </View>
      ) : null}

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Сделать новым текущим сезоном</Text>
        <Switch value={setAsActive} onValueChange={setSetAsActive} />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.actions}>
        <Button
          title="Создать сезон"
          onPress={handleSubmit}
          disabled={saving || Boolean(duplicateExists)}
        />
        <Button title="Отмена" variant="ghost" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    ...typography.subtitle,
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  modeRow: {
    gap: spacing.sm,
  },
  modeChip: {
    minHeight: 48,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
  },
  modeSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  modeText: {
    ...typography.body,
    color: colors.text,
  },
  checklist: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    gap: spacing.md,
  },
  switchLabel: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },
  warn: {
    ...typography.caption,
    color: colors.error,
    marginTop: spacing.xs,
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
