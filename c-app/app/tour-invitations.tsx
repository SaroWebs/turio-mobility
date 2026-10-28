import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import api, { apiErrorMessage } from '../src/lib/api';
import { useTheme } from '../src/constants/theme';

type Invitation = { id: number; tour_title: string; departure_date: string; status: string };

export default function TourInvitations() {
  const router = useRouter();
  const { colors } = useTheme();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try { setInvitations((await api.get('/tour-shares/invitations')).data.data); }
    catch (e) { setError(apiErrorMessage(e, 'Unable to load invitations.')); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  return <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }} style={{ backgroundColor: colors.background }}>
    <Pressable accessibilityRole="button" onPress={() => router.back()} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: colors.brand }}>Back</Text></Pressable>
    <Text style={{ color: colors.text, fontSize: 24, fontWeight: '700' }}>Tour invitations</Text>
    <Text style={{ color: colors.textSecondary }}>Invitations sent to your verified mobile number. Open the original invitation link to securely view the shared trip.</Text>
    {loading && <ActivityIndicator color={colors.brand} />}
    {!!error && <Text accessibilityRole="alert" style={{ color: colors.error }}>{error}</Text>}
    {!loading && !error && !invitations.length && <Text style={{ color: colors.text }}>No pending invitations.</Text>}
    {invitations.map(invitation => <View key={invitation.id} style={{ padding: 16, gap: 8, borderRadius: 12, backgroundColor: colors.surface }}>
      <Text style={{ color: colors.text, fontSize: 18, fontWeight: '600' }}>{invitation.tour_title}</Text>
      <Text style={{ color: colors.textSecondary }}>{invitation.departure_date} · {invitation.status}</Text>
    </View>)}
    <Pressable accessibilityRole="button" disabled={loading} onPress={() => void load()} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: colors.brand }}>Refresh invitations</Text></Pressable>
  </ScrollView>;
}
