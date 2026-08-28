/**
 * Edit planting — rebind catalog item instead of mutating shared catalog rows.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  PlantingForm,
  type PlantingFormValues,
} from '@/src/components/planting/PlantingForm';
import { Screen } from '@/src/components/ui/Screen';
import { useGardenSnapshot } from '@/src/hooks/useGardenSnapshot';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import { resolveCatalogItemForPlanting } from '@/src/services/plantCatalogService';
import { deletePhotosForPlanting } from '@/src/services/photoCleanupService';
import { colors, typography } from '@/src/theme/tokens';

export default function EditPlantingScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { plantingRepository, catalogRepository, bumpRefresh, ready, db } =
    useDatabase();
  const { loading, garden, areas, catalogItems, catalogById } = useGardenSnapshot();
  const [saving, setSaving] = useState(false);

  const planting = useMemo(() => {
    if (!ready || !plantingRepository || !id) {
      return null;
    }
    return plantingRepository.getById(id);
  }, [ready, plantingRepository, id]);

  const catalog = useMemo(() => {
    if (!planting) {
      return null;
    }
    return catalogById.get(planting.catalogItemId) ?? null;
  }, [planting, catalogById]);

  if (loading || !ready || !planting || !garden) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          {ready && !planting ? (
            <Text style={styles.missing}>Посадка не найдена</Text>
          ) : null}
        </View>
      </Screen>
    );
  }

  const handleSubmit = (values: PlantingFormValues) => {
    if (!plantingRepository || !catalogRepository) {
      return;
    }

    setSaving(true);
    try {
      const catalogItem = resolveCatalogItemForPlanting(catalogRepository, {
        gardenId: garden.id,
        speciesName: values.speciesName,
        varietyName: values.varietyName,
        preferredCatalogItemId: values.preferredCatalogItemId,
      });

      plantingRepository.update(planting.id, {
        catalogItemId: catalogItem.id,
        areaId: values.areaId,
        quantity: values.quantity,
        quantityUnit: values.quantityUnit,
        status: values.status,
        sowingDate: values.sowingDate,
        transplantDate: values.transplantDate,
        notes: values.notes,
      });

      bumpRefresh();
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Удалить посадку?', 'Это действие нельзя отменить.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          if (!plantingRepository || !db) {
            return;
          }
          await deletePhotosForPlanting(db, planting.id);
          plantingRepository.delete(planting.id);
          bumpRefresh();
          router.back();
        },
      },
    ]);
  };

  const handleCopy = () => {
    router.push({
      pathname: '/planting/create',
      params: { copyFrom: planting.id },
    });
  };

  return (
    <Screen scroll keyboardShouldPersistTaps="handled">
      <PlantingForm
        areas={areas}
        catalogItems={catalogItems}
        initialPlanting={planting}
        initialCatalog={catalog}
        submitLabel="Сохранить"
        onSubmit={handleSubmit}
        onCancel={() => router.back()}
        onDelete={handleDelete}
        saving={saving}
      />
      <View style={styles.copyWrap}>
        <Pressable accessibilityRole="button" onPress={handleCopy}>
          <Text style={styles.copyHint}>Копировать посадку</Text>
        </Pressable>
      </View>
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
  copyWrap: {
    marginTop: 8,
    alignItems: 'center',
  },
  copyHint: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
    paddingVertical: 12,
  },
});
