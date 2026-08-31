/**
 * Create an expense record.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import {
  ExpenseForm,
  type ExpenseFormValues,
} from '@/src/components/expense/ExpenseForm';
import { Screen } from '@/src/components/ui/Screen';
import { useGardenSnapshot } from '@/src/hooks/useGardenSnapshot';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import { markMeaningfulActionCompleted } from '@/src/services/ads/adSession';
import { trackAnalyticsEvent } from '@/src/services/analytics/analytics';
import { ANALYTICS_EVENTS } from '@/src/services/analytics/events';

export default function CreateExpenseScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    areaId?: string;
    plantingId?: string;
  }>();
  const { bumpRefresh, expenseRepository } = useDatabase();
  const { loading, activeSeason, areas, activePlantings, catalogById } = useGardenSnapshot();
  const [saving, setSaving] = useState(false);

  const handleSubmit = (values: ExpenseFormValues) => {
    if (!expenseRepository || !activeSeason) {
      return;
    }

    setSaving(true);
    try {
      expenseRepository.create({
        seasonId: activeSeason.id,
        date: values.date,
        category: values.category,
        amountKopecks: values.amountKopecks,
        areaId: values.areaId,
        plantingId: values.plantingId,
        notes: values.notes,
      });
      bumpRefresh();
      trackAnalyticsEvent(ANALYTICS_EVENTS.EXPENSE_ADDED, {
        expense_category: values.category,
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

  return (
    <Screen scroll keyboardAvoiding keyboardShouldPersistTaps="handled">
      <Text style={styles.heading}>+ Расход</Text>
      <ExpenseForm
        areas={areas}
        plantings={activePlantings}
        catalogById={catalogById}
        initialAreaId={params.areaId ?? null}
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
