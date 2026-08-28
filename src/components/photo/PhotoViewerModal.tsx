/**
 * Fullscreen photo viewer modal.
 */

import React from 'react';
import {
  Modal,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { GardenPhoto } from '@/src/domain/types';
import { spacing, typography } from '@/src/theme/tokens';

type PhotoViewerModalProps = {
  photo: GardenPhoto | null;
  visible: boolean;
  onClose: () => void;
};

export function PhotoViewerModal({ photo, visible, onClose }: PhotoViewerModalProps) {
  if (!photo) {
    return null;
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable accessibilityRole="button" style={styles.closeArea} onPress={onClose}>
          <Text style={styles.closeLabel}>Закрыть</Text>
        </Pressable>
        <Image source={{ uri: photo.uri }} style={styles.image} resizeMode="contain" />
        {photo.caption ? (
          <Text style={styles.caption}>{photo.caption}</Text>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  closeArea: {
    alignSelf: 'flex-end',
    padding: spacing.sm,
  },
  closeLabel: {
    ...typography.button,
    color: '#FFFFFF',
  },
  image: {
    width: '100%',
    height: '70%',
  },
  caption: {
    ...typography.body,
    color: '#FFFFFF',
    textAlign: 'center',
  },
});
