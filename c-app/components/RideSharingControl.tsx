import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Switch, Text, View } from 'react-native';
import api, { apiErrorMessage } from '../src/lib/api';

export function RideSharingControl({ booking, onUpdated }: { booking: any; onUpdated: (ride: any) => void }) {
  const [saving, setSaving] = useState(false);
  const control = booking?.sharing_control;
  if (!control || booking.service_type !== 'point_to_point' || ['completed', 'cancelled', 'rejected'].includes(booking.status)) return null;
  const update = async (enabled: boolean) => {
    if (saving || !control.editable) return;
    setSaving(true);
    try {
      const { data } = await api.put(`/rides/${booking.id}/sharing`, { sharing_requested: enabled });
      onUpdated(data.data);
    } catch (error) {
      Alert.alert('Sharing preference', apiErrorMessage(error, 'Could not update sharing. Please try again.'));
      try { const { data } = await api.get(`/rides/${booking.id}`); onUpdated(data.data); } catch { /* Polling will retry. */ }
    } finally { setSaving(false); }
  };
  return <View style={styles.card}>
    <View style={styles.row}>
      <View style={styles.copy}><Text style={styles.title}>{control.locked ? 'Ride sharing confirmed' : 'Allow other passengers to join'}</Text><Text style={styles.status}>{booking.sharing_requested ? 'Sharing enabled' : 'Private ride'}</Text></View>
      {saving ? <ActivityIndicator accessibilityLabel="Updating sharing" color="#0F766E" /> : <Switch accessibilityLabel="Allow ride sharing" value={!!booking.sharing_requested} disabled={!control.editable} onValueChange={(value) => void update(value)} trackColor={{ true: '#0F766E' }} />}
    </View>
    <Text style={styles.help}>{control.reason}</Text>
    {control.editable && booking.sharing_requested && <Text style={styles.help}>Your driver can accept passengers whose route and timing fit your ride.</Text>}
  </View>;
}

const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#BCDCD3', backgroundColor: '#F0FAF6', gap: 8, marginVertical: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 }, copy: { flex: 1 },
  title: { fontSize: 16, lineHeight: 22, fontWeight: '700', color: '#173B32' }, status: { fontSize: 13, color: '#0F766E', marginTop: 4 },
  help: { fontSize: 13, lineHeight: 20, color: '#40534B' },
});
