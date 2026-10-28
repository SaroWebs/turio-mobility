import React, { useState } from 'react';
import { Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { AccountPage, Action, Copy, Panel } from '../components/AccountPage';
import api, { apiErrorMessage } from '../src/lib/api';
import { useAccountData } from '../src/lib/account';

type SavedItem = { id: string; title: string; service_type: 'tour' | 'rental' | 'destination' };
const fetchSaved = async (): Promise<SavedItem[]> => {
  const { data } = (await api.get('/wishlists')).data;
  return [...data.tours, ...data.places, ...data.rentals];
};
export default function SavedPlacesScreen() {
  const { data, error, ...state } = useAccountData(fetchSaved);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [importMessage, setImportMessage] = useState('');
  const importDevicePlaces = async () => {
    setBusy(true); setSaveError('');
    try {
      const raw = await AsyncStorage.getItem('wishlist_places');
      const ids: unknown = raw ? JSON.parse(raw) : [];
      const items = Array.isArray(ids) ? ids.filter(id => Number.isInteger(id) && id > 0).map(id => ({ service_type: 'destination', service_id: String(id) })) : [];
      if (items.length) {
        await api.post('/wishlists/sync', { items });
        await AsyncStorage.removeItem('wishlist_places');
        await state.reload();
      }
      setImportMessage(items.length ? 'Device saves added to your account.' : 'No older device saves found.');
    } catch (err) { setSaveError(apiErrorMessage(err)); }
    finally { setBusy(false); }
  };
  const remove = async (item: SavedItem) => {
    setBusy(true); setSaveError('');
    try { await api.post('/wishlists/toggle', { service_type: item.service_type, service_id: String(item.id), action: 'remove' }); await state.reload(); }
    catch (err) { setSaveError(apiErrorMessage(err)); }
    finally { setBusy(false); }
  };
  const getServiceBadge = (type: SavedItem['service_type']) => {
    switch (type) {
      case 'rental':
        return { label: 'DRIVELUX RENTAL', color: '#18181B', bg: '#F4F4F5' };
      case 'destination':
        return { label: 'TRAVEL DESTINATION', color: '#2563EB', bg: '#EFF6FF' };
      default:
        return { label: 'TRAVEL TOUR', color: '#2563EB', bg: '#EFF6FF' };
    }
  };

  return (
    <AccountPage title="Saved Places &amp; Tours" {...state} error={error || saveError}>
      <Panel title="Saved on this device">
        <Copy>Sync destinations saved offline on this device to your cloud account.</Copy>
        <Action label="Import device saves" disabled={busy} onPress={() => void importDevicePlaces()} />
        {!!importMessage && <Copy>{importMessage}</Copy>}
      </Panel>

      {data?.length === 0 && (
        <Panel title="Save your next adventure">
          <Copy>Tap the heart icon on any tour, destination, or DriveLux car to easily access it later.</Copy>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
            <View style={{ flex: 1 }}>
              <Action label="Explore Tours" onPress={() => router.push('/(tabs)/tours')} />
            </View>
            <View style={{ flex: 1 }}>
              <Action label="Explore Cars" onPress={() => router.push('/(tabs)/rentals')} />
            </View>
          </View>
        </Panel>
      )}

      {data?.map(item => {
        const badge = getServiceBadge(item.service_type);
        return (
          <Panel key={`${item.service_type}:${item.id}`} title={item.title}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginVertical: 3 }}>
              <View style={{ backgroundColor: badge.bg, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4 }}>
                <Text style={{ color: badge.color, fontSize: 9, fontWeight: '900' }}>{badge.label}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
              <View style={{ flex: 2 }}>
                <Action
                  label="View Details"
                  onPress={() => {
                    if (item.service_type === 'tour') router.push({ pathname: '/tour-details', params: { id: item.id } });
                    else if (item.service_type === 'destination') router.push({ pathname: '/place-details', params: { id: item.id } });
                    else router.push('/(tabs)/rentals');
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Action label="Remove" disabled={busy} onPress={() => void remove(item)} />
              </View>
            </View>
          </Panel>
        );
      })}
    </AccountPage>
  );
}
