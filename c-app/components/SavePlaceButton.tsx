import React, { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Heart } from 'lucide-react-native';
import api, { apiErrorMessage } from '../src/lib/api';
import { useTheme } from '../src/constants/theme';

export default function SavePlaceButton({ id, kind }: { id: string; kind: 'tour' | 'destination' }) {
  const { colors } = useTheme();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const check = useCallback(async () => {
    setError(''); setReady(false);
    try {
      const response = await api.post('/wishlists/toggle', { service_type: kind, service_id: String(id), action: 'check' });
      setSaved(response.data.data.inWishlist); setReady(true);
    } catch (err) { setError(apiErrorMessage(err)); }
  }, [id, kind]);
  useFocusEffect(useCallback(() => { void check(); }, [check]));
  const toggle = async () => {
    if (!ready) { await check(); return; }
    setBusy(true); setError('');
    try {
      const response = await api.post('/wishlists/toggle', { service_type: kind, service_id: String(id), action: saved ? 'remove' : 'add' });
      setSaved(response.data.data.inWishlist);
    } catch (err) { setError(apiErrorMessage(err)); }
    finally { setBusy(false); }
  };
  return <View><Pressable accessibilityRole="button" accessibilityLabel={saved ? 'Remove from saved places' : 'Save place'} disabled={busy} onPress={() => void toggle()} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8 }}><Heart size={20} color={colors.brand} fill={saved ? colors.brand : 'transparent'} /><Text style={{ color: colors.brand }}>{busy ? 'Saving…' : saved ? 'Saved' : error ? 'Retry saved status' : 'Save'}</Text></Pressable>{!!error && <Text accessibilityRole="alert" style={{ color: colors.error }}>{error}</Text>}</View>;
}
