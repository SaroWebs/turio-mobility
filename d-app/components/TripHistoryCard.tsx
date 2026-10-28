import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BusFront, CarFront, ChevronRight, Route } from 'lucide-react-native';
import { useTheme } from '../src/constants/theme';
import { labelStatus, money } from '../src/types/services';

type Item = { kind: 'ride' | 'tour' | 'rental'; title: string; subtitle: string; status: string; date?: string; amount?: number | string; payment_method?: string; payment_status?: string };

export default function TripHistoryCard({ item, onPress }: { item: Item; onPress: () => void }) {
  const { colors: c } = useTheme();
  const Icon = item.kind === 'tour' ? BusFront : item.kind === 'rental' ? CarFront : Route;
  const statusColor = item.status === 'completed' ? c.success : ['cancelled', 'declined', 'rejected'].includes(item.status) ? c.error : c.warning;
  return <Pressable accessibilityRole="button" accessibilityLabel={`View ${item.kind} from ${item.title}`} onPress={onPress} style={({ pressed }) => [s.card, { backgroundColor: c.surface, borderColor: c.border, opacity: pressed ? 0.7 : 1 }]}>
    <View style={s.header}><View style={[s.icon, { backgroundColor: c.brandSoft }]}><Icon size={20} color={c.brand} /></View><View style={s.flex}><Text style={[s.kind, { color: c.text }]}>{item.kind === 'ride' ? 'Point ride' : item.kind === 'tour' ? 'Tour assignment' : 'Car rental'}</Text><Text style={[s.caption, { color: c.textSecondary }]}>{item.date ? new Date(item.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Date unavailable'}</Text></View><ChevronRight size={20} color={c.textMuted} /></View>
    <View style={s.route}><Text style={[s.address, { color: c.text }]} numberOfLines={2}>{item.title}</Text><Text style={[s.caption, { color: c.textSecondary }]}>{item.kind === 'tour' ? 'Assignment details' : 'TO'}</Text><Text style={[s.address, { color: c.text }]} numberOfLines={2}>{item.subtitle}</Text></View>
    <View style={[s.footer, { borderColor: c.border }]}><View style={s.flex}><Text style={[s.status, { color: statusColor }]}>{labelStatus(item.status)}</Text>{item.payment_method && <Text style={[s.caption, { color: c.textSecondary }]}>{labelStatus(item.payment_method)}{item.payment_status ? ` · ${labelStatus(item.payment_status)}` : ''}</Text>}</View><View style={s.amount}><Text style={[s.value, { color: c.text }]}>{item.amount == null ? '—' : money(item.amount)}</Text><Text style={[s.caption, { color: c.textSecondary }]}>Amount</Text></View></View>
  </Pressable>;
}

const s = StyleSheet.create({
  card: { padding: 18, borderWidth: 1, borderRadius: 22, marginBottom: 14, gap: 18 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 }, flex: { flex: 1, minWidth: 0 }, icon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  kind: { fontSize: 15, fontWeight: '700' }, caption: { fontSize: 12, lineHeight: 18, marginTop: 3 }, route: { gap: 4 }, address: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
  footer: { paddingTop: 14, borderTopWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }, status: { fontSize: 13, fontWeight: '700' }, amount: { alignItems: 'flex-end', maxWidth: '45%' }, value: { fontSize: 21, fontWeight: '800' },
});
