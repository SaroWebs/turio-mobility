import React, { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { AccountPage, Action, Copy, Panel } from '../components/AccountPage';
import { getBookingUpdates, useAccountData } from '../src/lib/account';
import { useAuthStore } from '../src/store/auth';
import { apiErrorMessage } from '../src/lib/api';

export default function NotificationsScreen() {
  const router = useRouter();
  const userId = useAuthStore(state => state.user?.id);
  const key = `booking-updates-read:${userId}`;
  const [read, setRead] = useState<string[]>([]);
  const [saveError, setSaveError] = useState('');
  const fetchUpdates = useCallback(async () => {
    const [updates, stored] = await Promise.all([getBookingUpdates(), AsyncStorage.getItem(key)]);
    setRead(stored ? JSON.parse(stored) : []);
    return updates;
  }, [key]);
  const { data, error, ...state } = useAccountData(fetchUpdates);
  const markRead = async (keys: string[]) => {
    try { await AsyncStorage.setItem(key, JSON.stringify(keys)); setRead(keys); setSaveError(''); }
    catch (err) { setSaveError(apiErrorMessage(err, 'Could not save read status.')); }
  };
  const getKindBadge = (kind: string) => {
    switch (kind.toLowerCase()) {
      case 'ride':
        return { label: 'TAXI RIDE', color: '#F59E0B', bg: '#FEF3C7' };
      case 'rental':
        return { label: 'DRIVELUX RENTAL', color: '#18181B', bg: '#F4F4F5' };
      default:
        return { label: 'TRAVEL TOUR', color: '#2563EB', bg: '#EFF6FF' };
    }
  };

  return (
    <AccountPage title="Notifications" {...state} error={error || saveError}>
      <Copy>Latest live status updates for your active &amp; upcoming journeys.</Copy>
      {!!data?.length && (
        <Action label="Mark all as read" onPress={() => void markRead(data.map(item => item.key))} />
      )}
      {data?.length === 0 && (
        <Panel title="You’re all caught up">
          <Copy>Real-time booking and vehicle dispatch notifications will appear here.</Copy>
        </Panel>
      )}
      {data?.map(item => {
        const isUnread = !read.includes(item.key);
        const badge = getKindBadge(item.kind);
        return (
          <Panel
            key={item.key}
            title={item.title}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginVertical: 3 }}>
              {isUnread && (
                <View style={{ backgroundColor: '#EF4444', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                  <Text style={{ color: '#fff', fontSize: 9, fontWeight: '900' }}>NEW</Text>
                </View>
              )}
              <View style={{ backgroundColor: badge.bg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                <Text style={{ color: badge.color, fontSize: 9, fontWeight: '900' }}>{badge.label}</Text>
              </View>
            </View>
            <Copy>#{item.id} · Status: {item.status.replaceAll('_', ' ')} · {new Date(item.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Copy>
            <Action
              label="View Live Details"
              onPress={() => {
                void markRead([...new Set([...read, item.key])]);
                if (item.kind === 'ride') router.push({ pathname: '/ride-details', params: { id: item.id } });
                else router.push({ pathname: '/service-activity', params: { id: item.id, kind: item.kind, title: item.title } });
              }}
            />
          </Panel>
        );
      })}
    </AccountPage>
  );
}
