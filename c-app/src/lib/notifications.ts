import { isRunningInExpoGo } from 'expo';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

let notificationHandlerConfigured = false;

export async function registerForPushNotificationsAsync(): Promise<string | undefined> {
  // Remote push notifications were removed from Android Expo Go in SDK 53.
  // Importing expo-notifications there is enough to throw during app startup,
  // so keep the native module behind this runtime guard.
  if (Platform.OS === 'android' && isRunningInExpoGo()) {
    if (__DEV__) {
      console.log('Remote push notifications are disabled in Android Expo Go.');
    }
    return undefined;
  }

  try {
    const Notifications = await import('expo-notifications');

    if (!notificationHandlerConfigured) {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
      notificationHandlerConfigured = true;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    if (!Device.isDevice) {
      if (__DEV__) console.log('Push notifications require a physical device.');
      return undefined;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      if (__DEV__) console.log('Push notification permission was not granted.');
      return undefined;
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

    if (!projectId) {
      if (__DEV__) console.warn('Push registration skipped: EAS project ID is not configured.');
      return undefined;
    }

    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    if (__DEV__) console.log('Push token registered.');
    return token;
  } catch (error) {
    // Push registration must never prevent the rest of the app from loading.
    if (__DEV__) console.warn('Push registration failed:', error);
    return undefined;
  }
}
