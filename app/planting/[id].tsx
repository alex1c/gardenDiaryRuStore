/**
 * Planting details — culture info, history, and photos.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { DiaryEventCard } from '@/src/components/diary/DiaryEventCard';
import { PhotoViewerModal } from '@/src/components/photo/PhotoViewerModal';
import { Button } from '@/src/components/ui/Button';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { Screen } from '@/src/components/ui/Screen';
import { PLANTING_STATUS_LABELS } from '@/src/domain/codes';
import type { GardenPhoto } from '@/src/domain/types';
import { useGardenSnapshot } from '@/src/hooks/useGardenSnapshot';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import { formatCatalogLabel, formatQuantityWithUnit } from '@/src/services/plantingDisplay';
import { colors, spacing, typography } from '@/src/theme/tokens';
import { formatLocalDateShort } from '@/src/utils/dateFormatRu';
import { deletePhotosForPlanting } from '@/src/services/photoCleanupService';
import { saveGardenPhoto } from '@/src/services/photoService';
import { HarvestStatsService } from '@/src/services/harvestStatsService';
import { ExpenseStatsService } from '@/src/services/expenseStatsService';
import { formatHarvestQuantity } from '@/src/services/harvestFormat';
import {
  pickImageFromLibrary,
  takePhotoWithCamera,
} from '@/src/services/photoPickerService';

export default function PlantingDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { db, bumpRefresh, plantingRepository, eventRepository, photoRepository, areaRepository, harvestRepository, gardenPlantRepository, refreshToken } =
    useDatabase();
  const { loading, garden, season, areas, catalogById } = useGardenSnapshot();
  const [viewerPhoto, setViewerPhoto] = useState<GardenPhoto | null>(null);

  const planting = useMemo(() => {
    if (!plantingRepository || !id) {
      return null;
    }
    return plantingRepository.getById(id);
  }, [plantingRepository, id]);

  const catalog = useMemo(() => {
    if (!planting) {
      return null;
    }
    return catalogById.get(planting.catalogItemId) ?? null;
  }, [planting, catalogById]);

  const gardenPlant = useMemo(() => {
    if (!gardenPlantRepository || !planting?.gardenPlantId) {
      return null;
    }
    return gardenPlantRepository.getById(planting.gardenPlantId);
  }, [gardenPlantRepository, planting]);

  const area = useMemo(() => {
    if (!areaRepository || !planting?.areaId) {
      return null;
    }
    return areaRepository.getById(planting.areaId);
  }, [areaRepository, planting]);

  const events = useMemo(() => {
    if (!eventRepository || !id) {
      return [];
    }
    return eventRepository.listByPlanting(id, 20);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refreshToken busts cache after mutations
  }, [eventRepository, id, refreshToken]);

  const photos = useMemo(() => {
    if (!photoRepository || !id) {
      return [];
    }
    return photoRepository.listByPlanting(id, 12);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refreshToken busts cache after mutations
  }, [photoRepository, id, refreshToken]);

  const harvestSummary = useMemo(() => {
    if (!db || !id) {
      return null;
    }
    return new HarvestStatsService(db).getPlantingHarvestSummary(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refreshToken busts cache after mutations
  }, [db, id, refreshToken]);

  const expenseSummary = useMemo(() => {
    if (!db || !id) {
      return null;
    }
    return new ExpenseStatsService(db).getPlantingExpenseSummary(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refreshToken busts cache after mutations
  }, [db, id, refreshToken]);

  const areasById = useMemo(
    () => new Map(areas.map((item) => [item.id, item])),
    [areas]
  );
  const plantingsById = useMemo(
    () => (planting ? new Map([[planting.id, planting]]) : new Map()),
    [planting]
  );

  const handleAddPhoto = async () => {
    if (!db || !garden || !season || !planting) {
      return;
    }

    Alert.alert('Добавить фото', undefined, [
      {
        text: 'Галерея',
        onPress: async () => {
          const picked = await pickImageFromLibrary();
          if (!picked) {
            return;
          }
          await attachPhoto(picked.uri);
        },
      },
      {
        text: 'Камера',
        onPress: async () => {
          const picked = await takePhotoWithCamera();
          if (!picked) {
            return;
          }
          await attachPhoto(picked.uri);
        },
      },
      { text: 'Отмена', style: 'cancel' },
    ]);
  };

  const attachPhoto = async (sourceUri: string) => {
    if (!db || !garden || !season || !planting) {
      return;
    }
    try {
      await saveGardenPhoto(db, {
        gardenId: garden.id,
        sourceUri,
        seasonId: season.id,
        areaId: planting.areaId,
        plantingId: planting.id,
      });
      bumpRefresh();
    } catch {
      Alert.alert('Фото', 'Не удалось сохранить фотографию.');
    }
  };

  const handleDeletePlanting = () => {
    if (!planting || !db || !plantingRepository) {
      return;
    }

    Alert.alert('Удалить посадку?', 'Это действие нельзя отменить.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          await deletePhotosForPlanting(db, planting.id);
          plantingRepository.delete(planting.id);
          bumpRefresh();
          router.back();
        },
      },
    ]);
  };

  if (loading || !planting || !catalog) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  const qty = formatQuantityWithUnit(planting.quantity, planting.quantityUnit);
  const speciesLine = catalog.varietyName
    ? catalog.speciesName
    : formatCatalogLabel(catalog);
  const varietyLine = catalog.varietyName ?? null;

  return (
    <Screen scroll keyboardAvoiding keyboardShouldPersistTaps="handled">
      <Text style={styles.species}>{speciesLine}</Text>
      {varietyLine ? <Text style={styles.variety}>{varietyLine}</Text> : null}
      {area ? <Text style={styles.meta}>{area.name}</Text> : null}
      {qty ? <Text style={styles.meta}>{qty}</Text> : null}
      {gardenPlant ? (
        <Text style={styles.perennial}>
          Многолетнее
          {gardenPlant.plantedDate
            ? ` · посажено ${formatLocalDateShort(gardenPlant.plantedDate)}`
            : ''}
        </Text>
      ) : null}
      <Text style={styles.status}>{PLANTING_STATUS_LABELS[planting.status]}</Text>
      {planting.notes ? <Text style={styles.notes}>{planting.notes}</Text> : null}

      <View style={styles.toolbar}>
        <Button
          title="+ Запись"
          onPress={() =>
            router.push({
              pathname: '/event/create',
              params: { plantingId: planting.id, areaId: planting.areaId ?? undefined },
            })
          }
        />
        <Button
          title="+ Урожай"
          variant="secondary"
          onPress={() =>
            router.push({
              pathname: '/harvest/create',
              params: { plantingId: planting.id },
            })
          }
        />
        <Button
          title="+ Расход"
          variant="secondary"
          onPress={() =>
            router.push({
              pathname: '/expense/create',
              params: {
                plantingId: planting.id,
                areaId: planting.areaId ?? undefined,
              },
            })
          }
        />
        <Button title="+ Фото" variant="secondary" onPress={handleAddPhoto} />
        <Button
          title="Изменить"
          variant="secondary"
          onPress={() =>
            router.push({ pathname: '/planting/edit', params: { id: planting.id } })
          }
        />
      </View>

      <Text style={styles.sectionTitle}>Урожай</Text>
      {!harvestSummary || harvestSummary.recentHarvests.length === 0 ? (
        <EmptyState
          title="Урожай пока не записан"
          message="Добавьте первый сбор с этой посадки."
        >
          <Button
            title="+ Добавить урожай"
            onPress={() =>
              router.push({
                pathname: '/harvest/create',
                params: { plantingId: planting.id },
              })
            }
          />
        </EmptyState>
      ) : (
        <View style={styles.harvestBlock}>
          {harvestSummary.totalsText ? (
            <Text style={styles.harvestSeasonTotal}>
              За сезон: {harvestSummary.totalsText}
            </Text>
          ) : null}
          {harvestSummary.yieldPerPlant ? (
            <Text style={styles.yieldPerPlant}>{harvestSummary.yieldPerPlant}</Text>
          ) : null}
          {harvestSummary.recentHarvests.map((harvest) => (
            <Pressable
              key={harvest.id}
              accessibilityRole="button"
              onPress={() =>
                router.push({ pathname: '/harvest/edit', params: { id: harvest.id } })
              }
            >
              <Text style={styles.harvestLine}>
                {formatLocalDateShort(harvest.date)} —{' '}
                {formatHarvestQuantity(harvest.quantity, harvest.unit)}
              </Text>
            </Pressable>
          ))}
          <Button
            title="+ Добавить урожай"
            variant="secondary"
            onPress={() =>
              router.push({
                pathname: '/harvest/create',
                params: { plantingId: planting.id },
              })
            }
          />
        </View>
      )}

      <Text style={styles.sectionTitle}>Расходы</Text>
      {!expenseSummary ? (
        <EmptyState
          title="Расходы не привязаны"
          message="Запишите покупки, относящиеся к этой посадке."
        >
          <Button
            title="+ Добавить расход"
            onPress={() =>
              router.push({
                pathname: '/expense/create',
                params: {
                  plantingId: planting.id,
                  areaId: planting.areaId ?? undefined,
                },
              })
            }
          />
        </EmptyState>
      ) : (
        <View style={styles.harvestBlock}>
          <Text style={styles.harvestSeasonTotal}>
            Расходы: {expenseSummary.displayTotal}
          </Text>
          {expenseSummary.harvestTotalsText ? (
            <Text style={styles.metaLine}>
              Урожай: {expenseSummary.harvestTotalsText}
            </Text>
          ) : null}
          {expenseSummary.conditionalCostPerKg ? (
            <Text style={styles.yieldPerPlant}>
              {expenseSummary.conditionalCostPerKg}
            </Text>
          ) : null}
        </View>
      )}

      <Text style={styles.sectionTitle}>Фотографии</Text>
      {photos.length === 0 ? (
        <EmptyState
          title="Фотографий пока нет"
          message="Добавьте первое фото этой посадки."
        >
          <Button title="+ Добавить фото" onPress={handleAddPhoto} />
        </EmptyState>
      ) : (
        <View style={styles.photoRow}>
          {photos.map((photo) => (
            <Pressable
              key={photo.id}
              accessibilityRole="button"
              onPress={() => setViewerPhoto(photo)}
            >
              <Image source={{ uri: photo.uri }} style={styles.thumb} />
            </Pressable>
          ))}
        </View>
      )}

      <Text style={styles.sectionTitle}>История</Text>
      {events.length === 0 ? (
        <EmptyState
          title="Для этой посадки пока нет записей"
          message="Здесь появится история ухода и наблюдений."
        >
          <Button
            title="+ Добавить запись"
            onPress={() =>
              router.push({
                pathname: '/event/create',
                params: { plantingId: planting.id, areaId: planting.areaId ?? undefined },
              })
            }
          />
        </EmptyState>
      ) : (
        <View style={styles.history}>
          {events.map((event) => (
            <View key={event.id} style={styles.historyItem}>
              <Text style={styles.historyDate}>
                {formatLocalDateShort(event.eventDate)}
              </Text>
              <DiaryEventCard
                event={event}
                photos={photoRepository?.listByEvent(event.id) ?? []}
                areasById={areasById}
                plantingsById={plantingsById}
                catalogById={catalogById}
                harvestLinked={Boolean(harvestRepository?.getByEventId(event.id))}
                onPress={(eventId) => {
                  const linked = harvestRepository?.getByEventId(eventId);
                  if (linked) {
                    router.push({
                      pathname: '/harvest/edit',
                      params: { id: linked.id },
                    });
                    return;
                  }
                  router.push({ pathname: '/event/edit', params: { id: eventId } });
                }}
                onPhotoPress={setViewerPhoto}
              />
            </View>
          ))}
        </View>
      )}

      <Button title="Удалить посадку" variant="ghost" onPress={handleDeletePlanting} />

      <PhotoViewerModal
        photo={viewerPhoto}
        visible={viewerPhoto !== null}
        onClose={() => setViewerPhoto(null)}
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
  species: {
    ...typography.title,
    color: colors.text,
  },
  variety: {
    ...typography.subtitle,
    color: colors.text,
    marginTop: spacing.xs,
  },
  meta: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  perennial: {
    ...typography.body,
    color: colors.primary,
    marginTop: spacing.xs,
    fontWeight: '600',
  },
  status: {
    ...typography.body,
    color: colors.primary,
    marginTop: spacing.sm,
    fontWeight: '600',
  },
  notes: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  toolbar: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.subtitle,
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  photoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  thumb: {
    width: 88,
    height: 88,
    borderRadius: 8,
    backgroundColor: colors.surfaceMuted,
  },
  history: {
    gap: spacing.md,
  },
  historyItem: {
    gap: spacing.xs,
  },
  historyDate: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '600',
  },
  harvestBlock: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  harvestSeasonTotal: {
    ...typography.subtitle,
    color: colors.primary,
    fontWeight: '600',
  },
  yieldPerPlant: {
    ...typography.caption,
    color: colors.textMuted,
  },
  harvestLine: {
    ...typography.body,
    color: colors.text,
    paddingVertical: spacing.xs,
  },
  metaLine: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
