import React, { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Copy, Send, UserPlus, UserX, Users } from 'lucide-react-native';
import api, { API_URL, apiErrorMessage } from '../src/lib/api';
import { CardShadow, Radius, Spacing, Typography, useTheme } from '../src/constants/theme';

type Invitation = { id: number; name: string; phone: string; status: string };

export default function TourShareScreen() {
  const { id, title } = useLocalSearchParams<{ id: string; title?: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const [shares, setShares] = useState<Invitation[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState('');
  const [link, setLink] = useState('');

  const load = useCallback(async (refresh = false) => {
    if (!id) return;
    if (refresh) setRefreshing(true);
    try {
      const response = await api.get(`/tour-bookings/${id}/shares`);
      setShares(response.data?.data ?? []);
    } catch (error) {
      setMessage(apiErrorMessage(error, 'Could not load invitations.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const invite = async () => {
    if (!name.trim() || !phone.trim()) {
      setMessage('Enter a name and phone number.');
      return;
    }
    setBusy(true);
    setLink('');
    setMessage('');
    try {
      const response = await api.post(`/tour-bookings/${id}/shares`, { name: name.trim(), phone: phone.trim() });
      const token = response.data?.data?.token;
      if (token) {
        // Build the web link. The base URL points to the customer-app API; the website is one level up.
        const webOrigin = API_URL.replace(/\/api\/customer-app\/?$/, '');
        const shareLink = `${webOrigin}/shared-tour#${token}`;
        setLink(shareLink);
        setMessage('Invitation created. Share this link with the person you invited.');
        setName('');
        setPhone('');
        void load();
      }
    } catch (error) {
      setMessage(apiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const revoke = (share: Invitation) => {
    Alert.alert('Stop sharing?', `${share.name} will lose access to your tour.`, [
      { text: 'Keep sharing', style: 'cancel' },
      {
        text: 'Stop sharing', style: 'destructive', onPress: async () => {
          setBusy(true);
          try {
            await api.delete(`/tour-bookings/${id}/shares/${share.id}`);
            setMessage(`Sharing stopped for ${share.name}.`);
            setLink('');
            void load();
          } catch (error) {
            setMessage(apiErrorMessage(error));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const shareLink = async () => {
    if (!link) return;
    try {
      await Share.share({ message: `View my tour: ${link}`, url: link });
    } catch { /* user cancelled */ }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'Verified': return colors.success;
      case 'Expired': case 'Stopped': return colors.textMuted;
      default: return colors.accent;
    }
  };

  if (loading) {
    return <View style={[styles.centered, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.brand} /><Text style={[styles.body, { color: colors.textSecondary }]}>Loading invitations…</Text></View>;
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={[styles.back, { backgroundColor: colors.surface }]}><ArrowLeft size={20} color={colors.text} /></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>Share tour</Text>
          <Text style={[styles.headerMeta, { color: colors.textSecondary }]} numberOfLines={1}>{title || `Tour #${id}`}</Text>
        </View>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.brand} colors={[colors.brand]} />}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.row}><UserPlus size={20} color={colors.brand} /><Text style={[styles.cardTitle, { color: colors.text }]}>Invite someone</Text></View>
          <Text style={[styles.caption, { color: colors.textSecondary }]}>Invite up to 5 people to view your tour plan and status. They verify their mobile number to access.</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
            placeholder="Name"
            placeholderTextColor={colors.textMuted}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            maxLength={80}
          />
          <TextInput
            style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
            placeholder="Indian mobile number"
            placeholderTextColor={colors.textMuted}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            maxLength={20}
          />
          <Pressable accessibilityRole="button" disabled={busy} onPress={invite} style={[styles.primaryButton, { backgroundColor: colors.brand, opacity: busy ? 0.6 : 1 }]}>
            <Send size={16} color="#fff" /><Text style={styles.primaryText}>Create invitation</Text>
          </Pressable>
        </View>

        {!!message && <Text style={[styles.messageText, { color: colors.text }]}>{message}</Text>}

        {!!link && (
          <View style={[styles.card, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
            <Text style={[styles.caption, { color: colors.text, fontWeight: '700' }]}>Invitation link</Text>
            <Text style={[styles.linkText, { color: colors.textSecondary }]} selectable numberOfLines={2}>{link}</Text>
            <Text style={[styles.caption, { color: colors.textSecondary }]}>Expires in 24 hours or when the tour starts.</Text>
            <Pressable accessibilityRole="button" onPress={shareLink} style={[styles.secondaryButton, { borderColor: colors.brand }]}>
              <Copy size={16} color={colors.brand} /><Text style={[styles.secondaryText, { color: colors.brand }]}>Share link</Text>
            </Pressable>
          </View>
        )}

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.row}><Users size={20} color={colors.brand} /><Text style={[styles.cardTitle, { color: colors.text }]}>People you invited</Text></View>
          {shares.length === 0 && <Text style={[styles.caption, { color: colors.textMuted }]}>No invitations yet.</Text>}
          {shares.map(share => (
            <View key={share.id} style={[styles.invitationRow, { borderColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.invitationName, { color: colors.text }]}>{share.name}</Text>
                <Text style={[styles.caption, { color: colors.textSecondary }]}>{share.phone}</Text>
              </View>
              <Text style={[styles.statusBadge, { color: statusColor(share.status), borderColor: statusColor(share.status) }]}>{share.status}</Text>
              {['Invited', 'Verified'].includes(share.status) && (
                <Pressable accessibilityRole="button" accessibilityLabel={`Stop sharing with ${share.name}`} disabled={busy} onPress={() => revoke(share)} style={[styles.revokeButton, { borderColor: colors.error }]}>
                  <UserX size={14} color={colors.error} /><Text style={{ color: colors.error, fontSize: 12, fontWeight: '700' }}>Stop</Text>
                </Pressable>
              )}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 12 },
  header: { minHeight: 64, borderBottomWidth: 1, paddingHorizontal: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '900' },
  headerMeta: { fontSize: 11, marginTop: 2 },
  content: { padding: Spacing.md, paddingBottom: 48, gap: 14 },
  card: { borderWidth: 1, borderRadius: Radius.lg, padding: 17, gap: 12 },
  cardTitle: { ...Typography.heading },
  row: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  caption: { ...Typography.body },
  body: { ...Typography.body, textAlign: 'center' },
  input: { borderWidth: 1, borderRadius: Radius.sm, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  primaryButton: { minHeight: 48, borderRadius: Radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  secondaryButton: { minHeight: 44, borderWidth: 1.5, borderRadius: Radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  secondaryText: { fontSize: 14, fontWeight: '700' },
  messageText: { fontSize: 13, lineHeight: 19, paddingVertical: 4 },
  linkText: { fontSize: 12, lineHeight: 18 },
  invitationRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1 },
  invitationName: { fontSize: 14, fontWeight: '700' },
  statusBadge: { borderWidth: 1, borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 4, fontSize: 11, fontWeight: '800', overflow: 'hidden' },
  revokeButton: { borderWidth: 1, borderRadius: Radius.sm, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6 },
});
