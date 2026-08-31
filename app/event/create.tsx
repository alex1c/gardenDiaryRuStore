/**
 * Create a manual diary entry with optional photos.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';

import {
  AddPhotoActions,
  type PendingPhoto,
} from '@/src/components/photo/AddPhotoActions';
import {
  EventForm,
  type EventFormValues,
} from '@/src/components/diary/EventForm';
import { Screen } from '@/src/components/ui/Screen';
import { useGardenSnapshot } from '@/src/hooks/useGardenSnapshot';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import { saveGardenPhoto } from '@/src/services/photoService';

export default function CreateEventScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    areaId?: string;
    plantingId?: string;
  }>();
  const { db, bumpRefresh, eventRepository } = useDatabase();
  const { loading, garden, activeSeason, areas, activePlantings, catalogById } = useGardenSnapshot();
  const [saving, setSaving] = useState(false);
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);

  const handlePhotoReady = useCallback((photo: PendingPhoto) => {
    setPendingPhotos((current) => [...current, photo]);
  }, []);

  const handleSubmit = async (values: EventFormValues) => {
    if (!eventRepository || !activeSeason || !garden || !db) {
      return;
    }

    setSaving(true);
    try {
      const event = eventRepository.create({
        seasonId: activeSeason.id,
        title: values.title,
        type: values.type,
        eventDate: values.eventDate,
        areaId: values.areaId,
        plantingId: values.plantingId,
        notes: values.notes,
      });

      const photoErrors: string[] = [];
      for (const pending of pendingPhotos) {
        try {
          await saveGardenPhoto(db, {
            gardenId: garden.id,
            sourceUri: pending.sourceUri,
            seasonId: activeSeason.id,
            areaId: values.areaId,
            plantingId: values.plantingId,
            eventId: event.id,
            caption: pending.caption || null,
            takenAtLocalDate: values.eventDate,
          });
        } catch {
          photoErrors.push('одно из фото');
        }
      }

      bumpRefresh();
      if (photoErrors.length > 0) {
        Alert.alert(
          'Запись сохранена',
          'Не удалось прикрепить часть фотографий. Запись в дневнике сохранена.'
        );
      }
      router.back();
    } finally {
      setSaving(false);
    }
  };

  if (loading || !activeSeason || !garden) {
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
      <Text style={styles.heading}>+ Запись</Text>
      <EventForm
        areas={areas}
        plantings={activePlantings}
        catalogById={catalogById}
        initialAreaId={params.areaId ?? null}
        initialPlantingId={params.plantingId ?? null}
        submitLabel="Сохранить"
        saving={saving}
        onSubmit={handleSubmit}
        onCancel={() => router.back()}
        extraActions={
          <>
            <AddPhotoActions onPhotoReady={handlePhotoReady} disabled={saving} />
            {pendingPhotos.length > 0 ? (
              <Text style={styles.pending}>
                Фото к записи: {pendingPhotos.length}
              </Text>
            ) : null}
          </>
        }
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
  pending: {
    fontSize: 14,
    color: '#4A5A50',
  },
});
