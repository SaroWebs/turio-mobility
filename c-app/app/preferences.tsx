import React from 'react';
import { Linking, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { AccountPage, Action, Copy, Panel } from '../components/AccountPage';
import { usePreferences } from '../src/store/preferences';

export default function PreferencesScreen() {
  const { appearance, setAppearance } = usePreferences();
  const router = useRouter();
  const [error, setError] = React.useState('');
  return <AccountPage title="Preferences" error={error}>
    <Panel title="Appearance">
      <Copy>Saved on this device.</Copy>
      {(['system', 'light', 'dark'] as const).map(mode => <Action key={mode} label={`${mode === 'system' ? 'Use device setting' : mode === 'light' ? 'Light' : 'Dark'}${appearance === mode ? ' · Selected' : ''}`} onPress={() => setAppearance(mode)} />)}
    </Panel>
    <Panel title="Notifications">
      <Copy>Manage notification permission in your device settings. Booking updates are also available in the app.</Copy>
      {Platform.OS !== 'web' && <Action label="Open device settings" onPress={() => { void Linking.openSettings().catch(() => setError('Unable to open settings. Open your device settings manually.')); }} />}
      {Platform.OS === 'web' && <Copy>Use your browser’s site settings to manage notification permission.</Copy>}
      <Action label="View booking updates" onPress={() => router.push('/notifications')} />
    </Panel>
    <Panel title="Language"><Copy>English is currently the supported app language.</Copy></Panel>
    <Action label="Payment preference" onPress={() => router.push('/payment-methods')} />
  </AccountPage>;
}
