/**
 * Photo pick actions — gallery and optional camera.
 */

import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/src/components/ui/Button';
import { TextField } from '@/src/components/ui/TextField';
import {
  pickImageFromLibrary,
  takePhotoWithCamera,
} from '@/src/services/photoPickerService';
import { colors, spacing, typography } from '@/src/theme/tokens';

type PendingPhoto = {
  sourceUri: string;
  caption: string;
};

type AddPhotoActionsProps = {
  onPhotoReady: (photo: PendingPhoto) => void;
  disabled?: boolean;
};

export function AddPhotoActions({ onPhotoReady, disabled = false }: AddPhotoActionsProps) {
  const [captionDraft, setCaptionDraft] = useState('');

  const handlePicked = (uri: string) => {
    onPhotoReady({
      sourceUri: uri,
      caption: captionDraft.trim(),
    });
    setCaptionDraft('');
  };

  const handlePickLibrary = async () => {
    const picked = await pickImageFromLibrary();
    if (!picked) {
      Alert.alert('Фото', 'Не удалось выбрать изображение или доступ не предоставлен.');
      return;
    }
    handlePicked(picked.uri);
  };

  const handleTakePhoto = async () => {
    const picked = await takePhotoWithCamera();
    if (!picked) {
      Alert.alert('Камера', 'Не удалось сделать фото или доступ не предоставлен.');
      return;
    }
    handlePicked(picked.uri);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Фото</Text>
      <TextField
        label="Подпись (необязательно)"
        value={captionDraft}
        onChangeText={setCaptionDraft}
        placeholder="Например: первые завязи"
      />
      <View style={styles.row}>
        <Button
          title="Выбрать из галереи"
          variant="secondary"
          disabled={disabled}
          onPress={handlePickLibrary}
        />
        <Button
          title="Сделать фото"
          variant="secondary"
          disabled={disabled}
          onPress={handleTakePhoto}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  row: {
    gap: spacing.sm,
  },
});

export type { PendingPhoto };
