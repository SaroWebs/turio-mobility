const { getConfig } = require('@expo/config');
process.env.NODE_ENV ||= 'development';
require('@expo/env').load(process.cwd());

const { exp } = getConfig(process.cwd());
const plugin = exp.plugins.find((entry) => Array.isArray(entry) && entry[0] === 'react-native-maps');
const key = plugin?.[1]?.androidGoogleMapsApiKey;
const valid = typeof key === 'string' && /^AIza[\w-]{35}$/.test(key);
if (!valid || key !== exp.android?.config?.googleMaps?.apiKey) {
  console.error('Android Maps configuration is missing, invalid, or inconsistent. Set GOOGLE_MAPS_ANDROID_API_KEY in .env.local (or the EAS build environment).');
  process.exitCode = 1;
} else {
  console.log(`Android Maps key is wired for ${exp.android.package}. Key value withheld.`);
  if (key === plugin[1].iosGoogleMapsApiKey) {
    console.warn('Android and iOS currently share a key. Configure separate platform-restricted keys in Google Cloud.');
  }
  console.log('This validates local wiring only. Verify Maps SDK for Android, billing, and package/signing SHA-1 restrictions in Google Cloud.');
  console.log('Expo Go uses its own native Maps credentials; use npm run android:build to test this key.');
}
