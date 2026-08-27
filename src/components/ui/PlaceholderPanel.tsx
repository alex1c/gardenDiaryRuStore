/**
 * Placeholder content for tabs that are not yet implemented.
 */

import React from 'react';
import { StyleSheet, Text } from 'react-native';

import { Card } from '@/src/components/ui/Card';
import { colors, spacing, typography } from '@/src/theme/tokens';

type PlaceholderPanelProps = {
  title: string;
  description: string;
};

export function PlaceholderPanel({ title, description }: PlaceholderPanelProps) {
  return (
    <Card style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{description}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
  },
  title: {
    ...typography.subtitle,
    color: colors.text,
  },
  body: {
    ...typography.body,
    color: colors.textSecondary,
  },
});

export default PlaceholderPanel;
