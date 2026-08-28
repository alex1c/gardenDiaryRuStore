/**
 * Create planting — optional areaId and copyFrom query params.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import {
  PlantingForm,
  type PlantingFormValues,
} from '@/src/components/planting/PlantingForm';
import { Screen } from '@/src/components/ui/Screen';
import { useGardenSnapshot } from '@/src/hooks/useGardenSnapshot';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import { resolveCatalogItemForPlanting } from '@/src/services/plantCatalogService';
import { createPlantingWithOptionalPerennial } from '@/src/services/plantingService';
import { colors, typography } from '@/src/theme/tokens';

export default function CreatePlantingScreen() {
  const router = useRouter();
  const { areaId, copyFrom } = useLocalSearchParams<{
    areaId?: string;
    copyFrom?: string;
  }>();
  const { db, plantingRepository, catalogRepository, bumpRefresh, ready } =
    useDatabase();
  const { loading, garden, activeSeason, areas, catalogItems, catalogById } =
    useGardenSnapshot();
  const [saving, setSaving] = useState(false);

  const sourcePlanting = useMemo(() => {
    if (!ready || !plantingRepository || !copyFrom) {
      return null;
    }
    return plantingRepository.getById(copyFrom);
  }, [ready, plantingRepository, copyFrom]);

  const sourceCatalog = useMemo(() => {
    if (!sourcePlanting) {
      return null;
    }
    return catalogById.get(sourcePlanting.catalogItemId) ?? null;
  }, [sourcePlanting, catalogById]);

  if (loading || !ready || !garden || !activeSeason) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          {ready && !activeSeason ? (
            <Text style={styles.missing}>Сначала создайте участок и сезон</Text>
          ) : null}
        </View>
      </Screen>
    );
  }

  const handleSubmit = (values: PlantingFormValues) => {
    if (!plantingRepository || !catalogRepository || !db) {
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

      if (copyFrom && sourcePlanting) {
        plantingRepository.copy(copyFrom, {
          seasonId: activeSeason.id,
          catalogItemId: catalogItem.id,
          areaId: values.areaId,
          quantity: values.quantity,
          quantityUnit: values.quantityUnit,
          status: values.status,
          sowingDate: values.sowingDate,
          transplantDate: values.transplantDate,
          notes: values.notes,
        });
      } else {
        createPlantingWithOptionalPerennial(db, {
          seasonId: activeSeason.id,
          catalogItemId: catalogItem.id,
          areaId: values.areaId,
          quantity: values.quantity,
          quantityUnit: values.quantityUnit,
          status: values.status,
          sowingDate: values.sowingDate,
          transplantDate: values.transplantDate,
          notes: values.notes,
          isPerennial: values.isPerennial,
        });
      }

      bumpRefresh();
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen scroll keyboardShouldPersistTaps="handled">
      <PlantingForm
        areas={areas}
        catalogItems={catalogItems}
        initialAreaId={areaId ?? sourcePlanting?.areaId}
        initialPlanting={sourcePlanting}
        initialCatalog={sourceCatalog}
        submitLabel={copyFrom ? 'Сохранить копию' : 'Добавить'}
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
