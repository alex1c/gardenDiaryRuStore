/**
 * Create a harvest record with linked diary event.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import {
  HarvestForm,
  type HarvestFormValues,
} from '@/src/components/harvest/HarvestForm';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { Screen } from '@/src/components/ui/Screen';
import { useGardenSnapshot } from '@/src/hooks/useGardenSnapshot';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import { markMeaningfulActionCompleted } from '@/src/services/ads/adSession';
import { trackAnalyticsEvent } from '@/src/services/analytics/analytics';
import { ANALYTICS_EVENTS } from '@/src/services/analytics/events';
import { createHarvest } from '@/src/services/harvestService';

export default function CreateHarvestScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ plantingId?: string }>();
  const { db, bumpRefresh } = useDatabase();
  const { loading, activeSeason, activePlantings, catalogById } = useGardenSnapshot();
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (values: HarvestFormValues) => {
    if (!db || !activeSeason) {
      return;
    }

    setSaving(true);
    try {
      createHarvest(db, {
        seasonId: activeSeason.id,
        plantingId: values.plantingId,
        date: values.date,
        quantity: values.quantity,
        unit: values.unit,
        notes: values.notes,
      });
      bumpRefresh();
      trackAnalyticsEvent(ANALYTICS_EVENTS.HARVEST_ADDED, {
        harvest_unit: values.unit,
      });
      markMeaningfulActionCompleted();
      router.back();
    } finally {
      setSaving(false);
    }
  };

  if (loading || !activeSeason) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator size="large" />
        </View>
      </Screen>
    );
  }

  if (activePlantings.length === 0) {
    return (
      <Screen scroll>
        <EmptyState
          title="Нет посадок"
          message="Сначала добавьте посадку, чтобы записать урожай."
        />
      </Screen>
    );
  }

  return (
    <Screen scroll keyboardAvoiding keyboardShouldPersistTaps="handled">
      <Text style={styles.heading}>+ Урожай</Text>
      <HarvestForm
        plantings={activePlantings}
        catalogById={catalogById}
        initialPlantingId={params.plantingId ?? null}
        submitLabel="Сохранить"
        saving={saving}
        onSubmit={handleSubmit}
        onCancel={() => router.back()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 16,
  },
});
