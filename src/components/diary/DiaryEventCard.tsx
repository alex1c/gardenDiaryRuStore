/**
 * Timeline card for a single diary event with optional photo previews.
 */

import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/src/components/ui/Card';
import type { GardenArea, GardenEvent, GardenPhoto, PlantCatalogItem, Planting } from '@/src/domain/types';
import {
  canEditEvent,
  formatEventHeadline,
} from '@/src/services/eventDisplay';
import { formatTaskRelationSubtitle } from '@/src/services/taskDisplay';
import { colors, radii, spacing, typography } from '@/src/theme/tokens';

type DiaryEventCardProps = {
  event: GardenEvent;
  photos: GardenPhoto[];
  areasById: Map<string, GardenArea>;
  plantingsById: Map<string, Planting>;
  catalogById: Map<string, PlantCatalogItem>;
  onPress: (eventId: string) => void;
  onPhotoPress?: (photo: GardenPhoto) => void;
};

export function DiaryEventCard({
  event,
  photos,
  areasById,
  plantingsById,
  catalogById,
  onPress,
  onPhotoPress,
}: DiaryEventCardProps) {
  const subtitle = formatTaskRelationSubtitle(
    event,
    areasById,
    plantingsById,
    catalogById
  );
  const editable = canEditEvent(event);

  return (
    <Pressable accessibilityRole="button" onPress={() => onPress(event.id)}>
      <Card style={styles.card}>
        <Text style={styles.headline}>{formatEventHeadline(event)}</Text>
        <Text style={styles.title}>{event.title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {event.notes ? <Text style={styles.notes}>{event.notes}</Text> : null}
        {photos.length > 0 ? (
          <View style={styles.photoRow}>
            {photos.map((photo) => (
              <Pressable
                key={photo.id}
                accessibilityRole="button"
                onPress={(e) => {
                  e.stopPropagation?.();
                  onPhotoPress?.(photo);
                }}
              >
                <Image source={{ uri: photo.uri }} style={styles.thumb} />
              </Pressable>
            ))}
          </View>
        ) : null}
        {!editable ? (
          <Text style={styles.autoHint}>Выполненная работа</Text>
        ) : null}
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.xs,
  },
  headline: {
    ...typography.subtitle,
    color: colors.primary,
  },
  title: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  notes: {
    ...typography.body,
    color: colors.textSecondary,
  },
  photoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceMuted,
  },
  autoHint: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
