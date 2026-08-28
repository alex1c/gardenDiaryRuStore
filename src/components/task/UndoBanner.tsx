/**
 * Undo banner shown briefly after task completion.
 */

import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '@/src/theme/tokens';

type UndoBannerProps = {
  visible: boolean;
  message: string;
  onUndo: () => void;
  onDismiss: () => void;
  timeoutMs?: number;
};

export function UndoBanner({
  visible,
  message,
  onUndo,
  onDismiss,
  timeoutMs = 5000,
}: UndoBannerProps) {
  useEffect(() => {
    if (!visible) {
      return;
    }
    const timer = setTimeout(onDismiss, timeoutMs);
    return () => clearTimeout(timer);
  }, [visible, onDismiss, timeoutMs]);

  if (!visible) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.message}>{message}</Text>
      <Pressable accessibilityRole="button" onPress={onUndo}>
        <Text style={styles.undo}>Отменить</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.lg,
    backgroundColor: colors.text,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  message: {
    ...typography.body,
    color: '#FFFFFF',
    flex: 1,
  },
  undo: {
    ...typography.button,
    color: colors.primarySoft,
  },
});
