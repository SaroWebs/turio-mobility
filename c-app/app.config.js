module.exports = ({ config }) => {
  if (process.env.EAS_BUILD_PLATFORM === 'android' &&
      !/^AIza[\w-]{35}$/.test(process.env.GOOGLE_MAPS_ANDROID_API_KEY || '')) {
    throw new Error('Set GOOGLE_MAPS_ANDROID_API_KEY in the selected EAS environment before building Android.');
  }
  return ({
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
    'expo-secure-store',
    'expo-web-browser',
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Turiya Mobility uses your location to show nearby rides and pickup points.',
      },
    ],
    [
      'expo-notifications',
      {
        color: '#2563EB',
        defaultChannel: 'default',
      },
    ],
    [
      'react-native-maps',
      {
        androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY,
        iosGoogleMapsApiKey: process.env.GOOGLE_MAPS_IOS_API_KEY,
      },
    ],
  ],
  });
};
