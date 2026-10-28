import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';

const androidMapId =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_MAP_ID || undefined;

// Expo Go uses Expo's native Maps key, not this project's key. Only attach
// a project-owned cloud map style in a build configured with our own key.
export const GOOGLE_MAP_ID = Platform.OS === 'android' &&
  Constants.executionEnvironment !== ExecutionEnvironment.StoreClient ? androidMapId : undefined;
