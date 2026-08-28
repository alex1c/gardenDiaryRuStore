/**
 * Expo image picker wrapper — permissions requested only when user picks a photo.
 */

import * as ImagePicker from 'expo-image-picker';

export type PickedImage = {
  uri: string;
  takenAt: string | null;
};

/** Opens the gallery picker (Android Photo Picker when available). */
export async function pickImageFromLibrary(): Promise<PickedImage | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 0.85,
  });

  if (result.canceled || result.assets.length === 0) {
    return null;
  }

  const asset = result.assets[0];
  return {
    uri: asset.uri,
    takenAt: null,
  };
}

/** Opens the device camera when available. */
export async function takePhotoWithCamera(): Promise<PickedImage | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    return null;
  }

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: false,
    quality: 0.85,
  });

  if (result.canceled || result.assets.length === 0) {
    return null;
  }

  const asset = result.assets[0];
  return {
    uri: asset.uri,
    takenAt: new Date().toISOString(),
  };
}
