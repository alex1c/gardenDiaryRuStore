/**
 * Area summary card for the plot screen — tap opens area details.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/src/components/ui/Card';
import { GARDEN_AREA_TYPE_LABELS } from '@/src/domain/codes';
import type { GardenArea, PlantCatalogItem, Planting } from '@/src/domain/types';
import { buildAreaCardSubtitle, formatAreaDimensions } from '@/src/services/plantingDisplay';
import { colors, spacing, typography } from '@/src/theme/tokens';

type AreaCardProps = {
  area: GardenArea;
  plantings: Planting[];
  catalogById: Map<string, PlantCatalogItem>;
  onPress: () => void;
};

export function AreaCard({
  area,
  plantings,
  catalogById,
  onPress,
}: AreaCardProps) {
  const summary = buildAreaCardSubtitle(plantings, catalogById);
  const dimensions = formatAreaDimensions(area.length, area.width);

  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <Card style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.name} numberOfLines={2}>
            {area.name}
          </Text>
          <Text style={styles.type}>{GARDEN_AREA_TYPE_LABELS[area.type]}</Text>
        </View>
        <Text style={styles.subtitle} numberOfLines={3}>
          {summary.subtitle}
        </Text>
        {dimensions ? (
          <Text style={styles.meta} numberOfLines={1}>
            {dimensions}
          </Text>
        ) : null}
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.xs,
  },
  header: {
    gap: spacing.xs,
  },
  name: {
    ...typography.subtitle,
    color: colors.text,
    flexShrink: 1,
  },
  type: {
    ...typography.caption,
    color: colors.textMuted,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  meta: {
    ...typography.caption,
    color: colors.textMuted,
  },
});

export default AreaCard;
