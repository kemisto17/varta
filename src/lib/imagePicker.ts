import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

/**
 * Android's system document/photo picker does not need broad storage access.
 * iOS still requires the user-facing photo-library permission.
 */
export async function requestImageLibraryAccess() {
  if (Platform.OS !== 'ios') {
    return true;
  }

  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return permission.granted;
}
