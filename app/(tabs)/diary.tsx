/**
 * Дневник — timeline of manual and task-generated events with filters.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { SeasonBrowseBanner } from '@/src/components/season/SeasonBrowseBanner';
import { DiaryEventCard } from '@/src/components/diary/DiaryEventCard';
import { PhotoViewerModal } from '@/src/components/photo/PhotoViewerModal';
import { Button } from '@/src/components/ui/Button';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { Screen } from '@/src/components/ui/Screen';
import {
  DIARY_FILTER_LABELS,
  type DiaryFilterCategory,
} from '@/src/domain/codes';
import type { GardenPhoto } from '@/src/domain/types';
import { useDiaryTimeline } from '@/src/hooks/useDiaryTimeline';
import { useGardenSnapshot } from '@/src/hooks/useGardenSnapshot';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import { formatTaskRelationLabel } from '@/src/services/taskDisplay';
import { colors, radii, spacing, typography } from '@/src/theme/tokens';
import {
  formatLocalDateLong,
  formatLocalDateShort,
} from '@/src/utils/dateFormatRu';
import { toLocalDateString } from '@/src/utils/localDate';

export default function DiaryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ areaId?: string; plantingId?: string }>();
  const { harvestRepository } = useDatabase();
  const { loading: gardenLoading, season, areas, plantings, catalogById } =
    useGardenSnapshot();

  const [category, setCategory] = useState<DiaryFilterCategory>('all');
  const [filterAreaId, setFilterAreaId] = useState<string | null>(
    params.areaId ?? null
  );
  const [filterPlantingId, setFilterPlantingId] = useState<string | null>(
    params.plantingId ?? null
  );
  const [filterOpen, setFilterOpen] = useState(false);
  const [viewerPhoto, setViewerPhoto] = useState<GardenPhoto | null>(null);

  const { loading, groups, photosByEventId } = useDiaryTimeline(season?.id ?? null, {
    category,
    areaId: filterAreaId,
    plantingId: filterPlantingId,
  });

  const today = toLocalDateString(new Date());

  const areasById = useMemo(
    () => new Map(areas.map((area) => [area.id, area])),
    [areas]
  );
  const plantingsById = useMemo(
    () => new Map(plantings.map((p) => [p.id, p])),
    [plantings]
  );

  const handleEventPress = (eventId: string) => {
    const linkedHarvest = harvestRepository?.getByEventId(eventId);
    if (linkedHarvest) {
      router.push({ pathname: '/harvest/edit', params: { id: linkedHarvest.id } });
      return;
    }
    router.push({ pathname: '/event/edit', params: { id: eventId } });
  };

  const filterLabel = useMemo(() => {
    if (filterPlantingId) {
      return formatTaskRelationLabel(
        filterAreaId,
        filterPlantingId,
        areasById,
        plantingsById,
        catalogById
      );
    }
    if (filterAreaId) {
      return areasById.get(filterAreaId)?.name ?? 'Зона';
    }
    return 'Все зоны';
  }, [
    filterAreaId,
    filterPlantingId,
    areasById,
    plantingsById,
    catalogById,
  ]);

  if (gardenLoading || loading) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (!season) {
    return (
      <Screen scroll>
        <EmptyState
          title="Дневник"
          message="Сначала создайте или активируйте сезон — записи привязаны к сезону."
        >
          <Button
            title="Управление сезонами"
            onPress={() => router.push('/season/index')}
          />
        </EmptyState>
      </Screen>
    );
  }

  const hasEvents = groups.length > 0;

  return (
    <Screen scroll keyboardShouldPersistTaps="handled">
      <SeasonBrowseBanner />
      <Text style={styles.heading}>Дневник</Text>

      <View style={styles.toolbar}>
        <Button
          title="+ Запись"
          onPress={() =>
            router.push({
              pathname: '/event/create',
              params: {
                areaId: filterAreaId ?? undefined,
                plantingId: filterPlantingId ?? undefined,
              },
            })
          }
        />
        <Button
          title={`Фильтр: ${filterLabel}`}
          variant="secondary"
          onPress={() => setFilterOpen(true)}
        />
      </View>

      <View style={styles.chips}>
        {(Object.keys(DIARY_FILTER_LABELS) as DiaryFilterCategory[]).map((key) => (
          <Pressable
            key={key}
            accessibilityRole="button"
            onPress={() => setCategory(key)}
            style={[styles.chip, category === key ? styles.chipSelected : null]}
          >
            <Text
              style={[
                styles.chipLabel,
                category === key ? styles.chipLabelSelected : null,
              ]}
            >
              {DIARY_FILTER_LABELS[key]}
            </Text>
          </Pressable>
        ))}
      </View>

      {!hasEvents ? (
        <EmptyState
          title="Дневник пока пуст"
          message="Добавляйте наблюдения и фотографии — со временем здесь появится история вашего участка."
        >
          <Button
            title="+ Первая запись"
            onPress={() => router.push('/event/create')}
          />
        </EmptyState>
      ) : (
        groups.map((group) => (
          <View key={group.date} style={styles.section}>
            <Text style={styles.sectionTitle}>
              {formatGroupHeading(group.date, today)}
            </Text>
            <View style={styles.list}>
              {group.events.map((event) => (
                <DiaryEventCard
                  key={event.id}
                  event={event}
                  photos={photosByEventId.get(event.id) ?? []}
                  areasById={areasById}
                  plantingsById={plantingsById}
                  catalogById={catalogById}
                  harvestLinked={Boolean(harvestRepository?.getByEventId(event.id))}
                  onPress={handleEventPress}
                  onPhotoPress={setViewerPhoto}
                />
              ))}
            </View>
          </View>
        ))
      )}

      <Modal visible={filterOpen} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Фильтр</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setFilterAreaId(null);
                setFilterPlantingId(null);
              }}
            >
              <Text style={styles.modalOption}>Все зоны</Text>
            </Pressable>
            {areas.map((area) => (
              <Pressable
                key={area.id}
                accessibilityRole="button"
                onPress={() => {
                  setFilterAreaId(area.id);
                  setFilterPlantingId(null);
                }}
              >
                <Text style={styles.modalOption}>{area.name}</Text>
              </Pressable>
            ))}
            {plantings.map((planting) => {
              const catalog = catalogById.get(planting.catalogItemId);
              const label = catalog
                ? catalog.varietyName ?? catalog.speciesName
                : 'Посадка';
              return (
                <Pressable
                  key={planting.id}
                  accessibilityRole="button"
                  onPress={() => {
                    setFilterPlantingId(planting.id);
                    if (planting.areaId) {
                      setFilterAreaId(planting.areaId);
                    }
                  }}
                >
                  <Text style={styles.modalOption}>{label}</Text>
                </Pressable>
              );
            })}
            <Button title="Готово" onPress={() => setFilterOpen(false)} />
          </View>
        </View>
      </Modal>

      <PhotoViewerModal
        photo={viewerPhoto}
        visible={viewerPhoto !== null}
        onClose={() => setViewerPhoto(null)}
      />
    </Screen>
  );
}

function formatGroupHeading(date: string, today: string): string {
  if (date === today) {
    return `Сегодня · ${formatLocalDateShort(date)}`;
  }
  return formatLocalDateLong(date);
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.md,
  },
  toolbar: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 44,
    justifyContent: 'center',
  },
  chipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  chipLabel: {
    ...typography.body,
    color: colors.text,
  },
  chipLabelSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  section: {
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.subtitle,
    color: colors.text,
  },
  list: {
    gap: spacing.sm,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    maxHeight: '70%',
  },
  modalTitle: {
    ...typography.subtitle,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  modalOption: {
    ...typography.body,
    color: colors.text,
    paddingVertical: spacing.sm,
    minHeight: 44,
  },
});
