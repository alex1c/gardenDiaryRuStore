/**
 * Edit or delete a harvest record; diary event stays in sync.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  HarvestForm,
  type HarvestFormValues,
} from '@/src/components/harvest/HarvestForm';
import { Screen } from '@/src/components/ui/Screen';
import { useGardenSnapshot } from '@/src/hooks/useGardenSnapshot';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import { deleteHarvest, updateHarvest } from '@/src/services/harvestService';

export default function EditHarvestScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { db, bumpRefresh, harvestRepository } = useDatabase();
  const { loading, season, plantings, catalogById } = useGardenSnapshot();
  const [saving, setSaving] = useState(false);

  const harvest = useMemo(() => {
    if (!harvestRepository || !id) {
      return null;
    }
    return harvestRepository.getById(id);
  }, [harvestRepository, id]);

  const handleSubmit = async (values: HarvestFormValues) => {
    if (!db || !harvest) {
      return;
    }

    setSaving(true);
    try {
      updateHarvest(db, harvest.id, {
        date: values.date,
        quantity: values.quantity,
        unit: values.unit,
        notes: values.notes,
      });
      bumpRefresh();
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!db || !harvest) {
      return;
    }

    Alert.alert('Удалить запись об урожае?', undefined, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: () => {
          deleteHarvest(db, harvest.id);
          bumpRefresh();
          router.back();
        },
      },
    ]);
  };

  if (loading || !harvest || !season) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator size="large" />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll keyboardShouldPersistTaps="handled">
      <Text style={styles.heading}>Изменить урожай</Text>
      <HarvestForm
        plantings={plantings}
        catalogById={catalogById}
        initialHarvest={harvest}
        submitLabel="Сохранить"
        saving={saving}
        onSubmit={handleSubmit}
        onCancel={() => router.back()}
        onDelete={handleDelete}
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
