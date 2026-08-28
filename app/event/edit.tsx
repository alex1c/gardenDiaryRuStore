/**
 * View/edit/delete a diary event. Task-generated events are read-only.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { EventForm, type EventFormValues } from '@/src/components/diary/EventForm';
import {
  AddPhotoActions,
  type PendingPhoto,
} from '@/src/components/photo/AddPhotoActions';
import { PhotoViewerModal } from '@/src/components/photo/PhotoViewerModal';
import { Screen } from '@/src/components/ui/Screen';
import type { GardenPhoto } from '@/src/domain/types';
import { useGardenSnapshot } from '@/src/hooks/useGardenSnapshot';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import { canEditEvent } from '@/src/services/eventDisplay';
import {
  deletePhotosForEvent,
  deletePhotoWithFile,
} from '@/src/services/photoCleanupService';
import { saveGardenPhoto } from '@/src/services/photoService';

export default function EditEventScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { db, bumpRefresh, eventRepository, photoRepository, harvestRepository, refreshToken } = useDatabase();
  const { loading, garden, season, areas, plantings, catalogById } = useGardenSnapshot();
  const [saving, setSaving] = useState(false);
  const [viewerPhoto, setViewerPhoto] = useState<GardenPhoto | null>(null);

  const event = useMemo(() => {
    if (!eventRepository || !id) {
      return null;
    }
    return eventRepository.getById(id);
  }, [eventRepository, id]);

  const photos = useMemo(() => {
    if (!photoRepository || !id) {
      return [] as GardenPhoto[];
    }
    return photoRepository.listByEvent(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refreshToken busts cache after mutations
  }, [photoRepository, id, refreshToken]);

  const linkedHarvest = useMemo(() => {
    if (!harvestRepository || !id) {
      return null;
    }
    return harvestRepository.getByEventId(id);
  }, [harvestRepository, id]);

  useEffect(() => {
    if (linkedHarvest) {
      router.replace({ pathname: '/harvest/edit', params: { id: linkedHarvest.id } });
    }
  }, [linkedHarvest, router]);

  const readOnly = event ? !canEditEvent(event, { harvestLinked: Boolean(linkedHarvest) }) : false;

  const handleSubmit = async (values: EventFormValues) => {
    if (!eventRepository || !event || !db || !garden || !season) {
      return;
    }

    setSaving(true);
    try {
      eventRepository.updateManual(event.id, {
        title: values.title,
        type: values.type,
        eventDate: values.eventDate,
        areaId: values.areaId,
        plantingId: values.plantingId,
        notes: values.notes,
      });
      bumpRefresh();
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!event || !db || !eventRepository) {
      return;
    }

    Alert.alert('Удалить запись?', event.title, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          await deletePhotosForEvent(db, event.id);
          eventRepository.deleteManual(event.id);
          bumpRefresh();
          router.back();
        },
      },
    ]);
  };

  const handleAddPhoto = async (pending: PendingPhoto) => {
    if (!db || !garden || !season || !event) {
      return;
    }

    try {
      await saveGardenPhoto(db, {
        gardenId: garden.id,
        sourceUri: pending.sourceUri,
        seasonId: season.id,
        areaId: event.areaId,
        plantingId: event.plantingId,
        eventId: event.id,
        caption: pending.caption || null,
        takenAtLocalDate: event.eventDate,
      });
      bumpRefresh();
    } catch {
      Alert.alert('Фото', 'Не удалось сохранить фотографию.');
    }
  };

  const handleDeletePhoto = (photo: GardenPhoto) => {
    if (!db) {
      return;
    }
    Alert.alert('Удалить фото?', undefined, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          await deletePhotoWithFile(db, photo.id);
          bumpRefresh();
        },
      },
    ]);
  };

  if (loading || !event || !season || !garden) {
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
      <Text style={styles.heading}>{readOnly ? 'Запись' : 'Изменить запись'}</Text>

      {photos.length > 0 ? (
        <View style={styles.photoSection}>
          <Text style={styles.sectionTitle}>Фотографии</Text>
          <View style={styles.photoRow}>
            {photos.map((photo) => (
              <Pressable
                key={photo.id}
                accessibilityRole="button"
                onPress={() => setViewerPhoto(photo)}
                onLongPress={() => !readOnly && handleDeletePhoto(photo)}
              >
                <Image source={{ uri: photo.uri }} style={styles.thumb} />
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <EventForm
        areas={areas}
        plantings={plantings}
        catalogById={catalogById}
        initialEvent={event}
        submitLabel="Сохранить"
        saving={saving}
        readOnly={readOnly}
        onSubmit={handleSubmit}
        onCancel={() => router.back()}
        onDelete={readOnly ? undefined : handleDelete}
        extraActions={
          readOnly ? null : <AddPhotoActions onPhotoReady={handleAddPhoto} disabled={saving} />
        }
      />

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
  heading: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  photoSection: {
    marginBottom: 16,
  },
  photoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: 8,
    backgroundColor: '#EEF2EA',
  },
});
