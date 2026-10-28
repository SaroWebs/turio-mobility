import React, { useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { AccountPage, Action, Copy, Panel } from '../components/AccountPage';
import { apiErrorMessage } from '../src/lib/api';

export default function SafetyPrivacyScreen() {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const clearCache = async () => {
    try {
      await AsyncStorage.multiRemove(['cached_tours', 'cached_destinations', 'cached_tour_filters']);
      setConfirm(false); setMessage('Saved browsing cache cleared.'); setError('');
    } catch (err) { setError(apiErrorMessage(err, 'Could not clear cache.')); }
  };
  return <AccountPage title="Safety and privacy" error={error}>
    <Panel title="Journey safety"><Copy>Check the driver and vehicle details against your booking before boarding. Open your journey to view its status and available tracking or sharing controls.</Copy>
      <Action label="Open my journeys" onPress={() => router.push('/(tabs)/activity')} />
      <Action label="Report a safety concern" onPress={() => router.push({ pathname: '/help-center', params: { category: 'safety', subject: 'Safety concern' } })} />
      <Copy>Support tickets are not an emergency service. Contact local emergency services if you are in immediate danger.</Copy>
    </Panel>
    <Panel title="Your data"><Copy>Request a copy, correction, or deletion of your account data through support. The team will confirm your request and explain any records that must be retained.</Copy>
      <Action label="Request my account data" onPress={() => router.push({ pathname: '/help-center', params: { category: 'account', subject: 'Account data request' } })} />
      <Action label="Request account deletion" onPress={() => router.push({ pathname: '/help-center', params: { category: 'account', subject: 'Account deletion request' } })} />
    </Panel>
    <Panel title="Browsing cache"><Copy>Remove downloaded tour listings, destinations, and tour filters from this device. Your bookings and saved places stay in your account.</Copy>
      <Action label={confirm ? 'Confirm clear browsing cache' : 'Clear browsing cache'} onPress={() => confirm ? void clearCache() : setConfirm(true)} />
      {confirm && <Action label="Cancel" onPress={() => setConfirm(false)} />}{!!message && <Copy>{message}</Copy>}
    </Panel>
  </AccountPage>;
}
