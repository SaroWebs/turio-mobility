import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import api, { apiErrorMessage } from '../src/lib/api';

type Notice = { id: number; message: string; read_at: string | null; created_at: string };
export default function VerificationInbox() {
  const [items, setItems] = useState<Notice[]>([]);
  const [page, setPage] = useState(1);
  const [last, setLast] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async (next = 1) => {
    setLoading(true);
    try {
      const { data } = await api.get('/verification-notices', { params: { page: next } });
      setItems((current) => next === 1 ? data.data.data : [...current, ...data.data.data]);
      setPage(next); setLast(data.data.last_page); setError('');
    } catch (e) { setError(apiErrorMessage(e, 'Could not load verification updates.')); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const read = async (id: number) => {
    try {
      await api.post(`/verification-notices/${id}/read`);
      setItems((current) => current.map((item) => item.id === id ? { ...item, read_at: new Date().toISOString() } : item));
    } catch (e) { setError(apiErrorMessage(e, 'Could not mark update as read.')); }
  };
  return <View style={{ gap: 12, paddingVertical: 16 }}>
    <Text style={{ fontSize: 18, fontWeight: '700' }}>Verification updates</Text>
    {error ? <Pressable accessibilityRole="button" onPress={() => void load()}><Text style={{ color: '#b42318' }}>{error} Tap to retry.</Text></Pressable> : null}
    {!loading && !items.length && !error && <Text>No verification updates yet.</Text>}
    {items.map((item) => <View key={item.id} style={{ padding: 12, backgroundColor: item.read_at ? '#f8fafc' : '#eff6ff', borderRadius: 12, gap: 6 }}>
      <Text>{item.message}</Text><Text style={{ color: '#475569', fontSize: 12 }}>{new Date(item.created_at).toLocaleString()}</Text>
      {!item.read_at && <Pressable accessibilityRole="button" onPress={() => void read(item.id)} style={{ paddingVertical: 10 }}><Text style={{ color: '#1d4ed8' }}>Mark as read</Text></Pressable>}
    </View>)}
    {loading ? <ActivityIndicator /> : page < last && <Pressable accessibilityRole="button" onPress={() => void load(page + 1)} style={{ padding: 12 }}><Text>Load earlier updates</Text></Pressable>}
  </View>;
}
