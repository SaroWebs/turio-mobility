import { Platform } from 'react-native';

const androidMapId =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_MAP_ID || '1dfe93eb92e94e7ce739e8b3';

export const GOOGLE_MAP_ID = Platform.OS === 'android' ? androidMapId : undefined;
