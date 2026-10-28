import { useRef, useState } from 'react';
import { ActivityIndicator, Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { MapPin, Navigation, Clock, CreditCard } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../src/constants/theme';

interface RideRequestModalProps {
  visible: boolean;
  ride: any | null;
  onAccept: (id: number) => void | Promise<void>;
  onDecline: (id: number) => void | Promise<void>;
}

export default function RideRequestModal({ visible, ride, onAccept, onDecline }: RideRequestModalProps) {
  const { colors: c } = useTheme();
  const insets = useSafeAreaInsets();
  const responding = useRef(false);
  const [pending, setPending] = useState<'accept' | 'decline' | null>(null);
  if (!ride) return null;
  const respond = async (action: 'accept' | 'decline') => {
    if (responding.current) return;
    responding.current = true;
    setPending(action);
    try { await (action === 'accept' ? onAccept(ride.id) : onDecline(ride.id)); }
    finally { responding.current = false; setPending(null); }
  };

  return <Modal visible={visible} transparent animationType="slide" onRequestClose={() => { /* Keep the request visible until a response is chosen. */ }}>
    <View style={[s.overlay, { backgroundColor: c.overlay }]}>
      <View style={[s.sheet, { backgroundColor: c.surface, paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={[s.handle, { backgroundColor: c.border }]} />
        <ScrollView contentContainerStyle={s.content}>
          <Text style={[s.eyebrow, { color: c.brand }]}>NEW RIDE REQUEST</Text>
          <Text accessibilityRole="header" style={[s.title, { color: c.text }]}>Your next trip</Text>
          <View style={[s.fare, { backgroundColor: c.brandSoft }]}><Text style={[s.label, { color: c.textSecondary }]}>Estimated trip fare</Text><Text style={[s.price, { color: c.brand }]}>₹{Number(ride.total_fare || 0).toLocaleString('en-IN')}</Text></View>
          <View style={s.metrics}>{[
            { Icon: Clock, text: ride.estimated_duration || 'Time unavailable' },
            { Icon: Navigation, text: ride.distance_km != null ? `${ride.distance_km} km` : 'Distance unavailable' },
            { Icon: CreditCard, text: ride.payment_method || 'Payment not specified' },
          ].map(({ Icon, text }) => <View key={text} style={[s.metric, { backgroundColor: c.surfaceMuted }]}><Icon size={16} color={c.textSecondary} /><Text style={[s.metricText, { color: c.textSecondary }]}>{text}</Text></View>)}</View>
          <View style={[s.route, { borderColor: c.border }]}>
            <View style={s.location}><Navigation size={19} color={c.brand} /><View style={s.flex}><Text style={[s.label, { color: c.textSecondary }]}>PICKUP</Text><Text style={[s.address, { color: c.text }]}>{ride.pickup_location}</Text></View></View>
            <View style={[s.divider, { backgroundColor: c.border }]} />
            <View style={s.location}><MapPin size={19} color={c.warning} /><View style={s.flex}><Text style={[s.label, { color: c.textSecondary }]}>DROP-OFF</Text><Text style={[s.address, { color: c.text }]}>{ride.dropoff_location}</Text></View></View>
          </View>
        </ScrollView>
        <View style={s.actions}>
          <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: !!pending, busy: pending === 'accept' }} disabled={!!pending} style={[s.accept, { opacity: pending ? 0.7 : 1 }]} onPress={() => void respond('accept')}>{pending === 'accept' ? <ActivityIndicator color="#FFFFFF" /> : <><Navigation size={20} color="#FFFFFF" /><Text style={s.acceptText}>Accept ride</Text></>}</TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" disabled={!!pending} accessibilityState={{ disabled: !!pending }} style={[s.decline, { borderColor: c.border }]} onPress={() => void respond('decline')}><Text style={[s.declineText, { color: c.textSecondary }]}>{pending === 'decline' ? 'Declining…' : 'Decline request'}</Text></TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>;
}

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' }, sheet: { width: '100%', maxWidth: 640, maxHeight: '92%', borderTopLeftRadius: 28, borderTopRightRadius: 28 }, handle: { width: 36, height: 4, borderRadius: 3, alignSelf: 'center', marginTop: 12, marginBottom: 8 },
  content: { padding: 24, paddingTop: 12, gap: 16 }, eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2 }, title: { fontSize: 28, fontWeight: '800', marginTop: -8 }, fare: { padding: 20, borderRadius: 20, gap: 6 }, label: { fontSize: 12, fontWeight: '600', lineHeight: 18 }, price: { fontSize: 36, fontWeight: '800' },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, metric: { paddingHorizontal: 10, paddingVertical: 9, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }, metricText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  route: { borderWidth: 1, borderRadius: 20, padding: 18 }, location: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' }, flex: { flex: 1, minWidth: 0 }, address: { fontSize: 16, lineHeight: 23, fontWeight: '600', marginTop: 4 }, divider: { height: 1, marginVertical: 18, marginLeft: 31 },
  actions: { paddingHorizontal: 24, gap: 10, paddingTop: 8 }, accept: { backgroundColor: '#0F766E', minHeight: 56, borderRadius: 16, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center' }, acceptText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' }, decline: { minHeight: 48, borderWidth: 1, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }, declineText: { fontSize: 15, fontWeight: '600' },
});
