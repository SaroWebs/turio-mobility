module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    config: {
      ...config.android?.config,
      ...(process.env.GOOGLE_MAPS_ANDROID_API_KEY
        ? {
            googleMaps: {
              apiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY,
            },
          }
        : {}),
    },
  },
  ios: {
    ...config.ios,
    config: {
      ...config.ios?.config,
      ...(process.env.GOOGLE_MAPS_IOS_API_KEY
        ? { googleMapsApiKey: process.env.GOOGLE_MAPS_IOS_API_KEY }
        : {}),
    },
  },
  plugins: [
    ...(config.plugins ?? []),
    'expo-image',
    ['expo-image-picker', { cameraPermission: 'Take photos of the four sides of your car for vehicle approval.', photosPermission: 'Choose car photos for vehicle approval.', microphonePermission: false }],
    [
      'react-native-maps',
      {
        androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY,
        iosGoogleMapsApiKey: process.env.GOOGLE_MAPS_IOS_API_KEY,
      },
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Turiya Mobility Driver uses your location to navigate to pickups and destinations.',
        locationAlwaysAndWhenInUsePermission:
          'Turiya Mobility Driver uses your location while you are online so customers can follow their assigned ride.',
        locationAlwaysPermission:
          'Turiya Mobility Driver uses your location while you are online so customers can follow their assigned ride.',
        isAndroidBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: true,
        isIosBackgroundLocationEnabled: true,
      },
    ],
  ],
});
