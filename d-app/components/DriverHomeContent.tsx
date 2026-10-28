import React from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { ArrowUpRight, Car, ChevronRight, FileCheck2, Navigation, Star, Wallet, Briefcase, Route, AlertCircle } from 'lucide-react-native';
import { useTheme } from '../src/constants/theme';

type Props = {
  name?: string; online: boolean; busy: boolean; loading: boolean; servicesAvailable: boolean;
  stats: any; wallet: any; vehicle: any; readiness: any; documents: any; rating?: number;
  assignments: number; locationError: string; onlineTitle: string; offlineTitle: string;
  onOnline: (value: boolean) => void; onRefresh: () => void; onNavigate: (path: string) => void;
};

export default function DriverHomeContent(props: Props) {
  const { colors: c } = useTheme();
  const balance = Number(props.wallet?.balance_minor ?? Number(props.wallet?.balance || 0) * 100);
  const minimumBalance = Number(props.wallet?.dispatch_eligible_balance_minor ?? 10000);
  const lowBalance = props.wallet && balance < minimumBalance;
  const needsTopup = props.wallet && (balance < Number(props.wallet.warning_balance_minor ?? 50000) || props.wallet.needs_topup_warning);
  const active = props.servicesAvailable && props.stats?.active_rides > 0;
  const card = { backgroundColor: c.surface, borderColor: c.border };
  const firstName = props.name?.trim().split(/\s+/)[0] || 'Driver';
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening';
  const money = (value: unknown) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

  return <ScrollView style={{ flex: 1, backgroundColor: c.background }} contentContainerStyle={s.content}
    refreshControl={<RefreshControl refreshing={props.loading} onRefresh={props.onRefresh} tintColor={c.brand} />}>
    <View style={s.header}>
      <View style={s.flex}><Text style={[s.eyebrow, { color: c.brand }]}>HAPPYMILES · DRIVER</Text><Text accessibilityRole="header" style={[s.title, { color: c.text }]}>{greeting}, {firstName}</Text><Text style={[s.copy, { color: c.textSecondary }]}>Your next journey starts here.</Text></View>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Open your account" onPress={() => props.onNavigate('/(tabs)/profile')} style={[s.avatar, { backgroundColor: c.brandSoft }]}><Text style={[s.avatarText, { color: c.brand }]}>{firstName.slice(0, 1).toUpperCase()}</Text></TouchableOpacity>
    </View>

    <View style={[s.availability, { backgroundColor: props.online ? '#115E59' : '#173B35' }]}>
      <View style={s.row}><View style={s.availabilityIcon}><Navigation color="#B9EEE0" size={23} /></View><View style={s.flex}><Text style={s.overline}>YOUR AVAILABILITY</Text><Text style={s.availabilityTitle}>{props.servicesAvailable ? props.online ? props.onlineTitle : props.offlineTitle : 'Let’s get you ready'}</Text></View>
        {props.servicesAvailable && <Switch accessibilityLabel="Receive ride requests" accessibilityState={{ disabled: props.busy || props.loading }} value={props.online} onValueChange={props.onOnline} disabled={props.busy || props.loading} trackColor={{ false: '#54766F', true: '#A3E7C9' }} thumbColor="#FFFFFF" />}
      </View>
      <View style={s.availabilityFooter}>{props.busy ? <ActivityIndicator color="#B9EEE0" /> : <View style={[s.dot, { backgroundColor: props.online ? '#A3E7C9' : '#D3B877' }]} />}<Text style={s.availabilityCopy}>{props.busy ? 'Updating your availability…' : !props.servicesAvailable ? 'Complete account approval to start receiving trips.' : props.online ? 'You’re visible to nearby customers.' : props.readiness && !props.readiness.can_go_online ? 'Complete vehicle and document approval before going online.' : 'Go online whenever you’re ready to drive.'}</Text></View>
    </View>
    {!!props.locationError && <Text accessibilityRole="alert" style={[s.notice, { color: c.error, backgroundColor: c.surface }]}>{props.locationError}</Text>}

    {active && <TouchableOpacity accessibilityRole="button" style={[s.resume, { backgroundColor: c.brandSoft, borderColor: c.brand }]} onPress={() => props.onNavigate('/active-ride')}><Navigation size={23} color={c.brand} /><View style={s.flex}><Text style={[s.cardTitle, { color: c.text }]}>Continue your active trip</Text><Text style={[s.copy, { color: c.textSecondary }]}>Navigation, pickup OTP and drop-off</Text></View><ArrowUpRight color={c.brand} size={23} /></TouchableOpacity>}

    <View style={s.sectionHeading}><Text style={[s.sectionTitle, { color: c.text }]}>Your performance</Text><View style={s.rating}><Star size={15} color={c.warning} /><Text style={[s.ratingText, { color: c.textSecondary }]}>{props.rating ? Number(props.rating).toFixed(1) : 'No ratings yet'}</Text></View></View>
    <View style={s.metrics}>
      {[{ label: 'Earnings', value: props.loading ? '—' : money(props.stats?.earnings), Icon: Wallet, path: '/(tabs)/wallet' }, { label: 'Completed trips', value: props.loading ? '—' : String(props.stats?.completed_rides ?? 0), Icon: Route, path: '/(tabs)/history' }].map(({ label, value, Icon, path }) => <TouchableOpacity key={label} accessibilityRole="button" onPress={() => props.onNavigate(path)} style={[s.metric, card]}><View style={s.row}><Icon size={20} color={c.brand} /><View style={s.flex} /><ArrowUpRight size={17} color={c.textMuted} /></View><Text style={[s.metricValue, { color: c.text }]}>{value}</Text><Text style={[s.copy, { color: c.textSecondary }]}>{label}</Text></TouchableOpacity>)}
    </View>

    {needsTopup && <TouchableOpacity accessibilityRole="button" style={[s.noticeRow, { backgroundColor: c.accentSoft, borderColor: c.warning }]} onPress={() => props.onNavigate('/(tabs)/wallet')}><AlertCircle color={c.warning} size={22} /><View style={s.flex}><Text style={[s.cardTitle, { color: c.text }]}>{lowBalance ? 'Top up to go online' : 'Your wallet is running low'}</Text><Text style={[s.copy, { color: c.textSecondary }]}>Balance {money(balance / 100)} · {lowBalance ? `At least ${money(minimumBalance / 100)} is needed to receive rides.` : 'Top up before your next trip.'}</Text></View><ChevronRight color={c.warning} size={20} /></TouchableOpacity>}

    <View style={s.sectionHeading}><Text style={[s.sectionTitle, { color: c.text }]}>Ready for the road</Text><Text style={[s.small, { color: c.textSecondary }]}>Vehicle & documents</Text></View>
    <View style={[s.group, card]}>
      <TouchableOpacity accessibilityRole="button" style={s.groupRow} onPress={() => props.onNavigate('/my-car')}><View style={[s.icon, { backgroundColor: c.brandSoft }]}><Car size={24} color={c.brand} /></View><View style={s.flex}><Text style={[s.cardTitle, { color: c.text }]}>{props.vehicle ? `${props.vehicle.make} ${props.vehicle.model}` : 'Add your vehicle'}</Text><Text style={[s.copy, { color: c.textSecondary }]}>{props.vehicle?.registration_number || 'Set up your car to receive trips'}</Text><Text style={[s.small, { color: props.vehicle?.approval_status === 'approved' ? c.success : c.warning, marginTop: 6 }]}>{props.vehicle?.approval_status === 'approved' ? 'Approved for service' : props.vehicle?.approval_status === 'rejected' ? 'Action needed' : props.vehicle ? 'Approval in progress' : 'Setup required'}</Text></View><ChevronRight size={19} color={c.textMuted} /></TouchableOpacity>
      <View style={[s.divider, { backgroundColor: c.border }]} />
      <TouchableOpacity accessibilityRole="button" style={s.groupRow} onPress={() => props.onNavigate('/documents')}><View style={[s.icon, { backgroundColor: c.surfaceMuted }]}><FileCheck2 size={23} color={c.brand} /></View><View style={s.flex}><Text style={[s.cardTitle, { color: c.text }]}>Driver documents</Text><Text style={[s.copy, { color: c.textSecondary }]}>{props.documents?.message || 'Manage your licence and verification'}</Text></View><ChevronRight size={19} color={c.textMuted} /></TouchableOpacity>
    </View>

    {props.servicesAvailable && <TouchableOpacity accessibilityRole="button" onPress={() => props.onNavigate('/(tabs)/explore')} style={[s.work, card]}><View style={[s.icon, { backgroundColor: c.accentSoft }]}><Briefcase color={c.warning} size={23} /></View><View style={s.flex}><Text style={[s.cardTitle, { color: c.text }]}>Your work</Text><Text style={[s.copy, { color: c.textSecondary }]}>{props.assignments ? `${props.assignments} tour and rental assignments to review` : 'Browse rides, tours and rental assignments'}</Text></View><ChevronRight color={c.textMuted} size={20} /></TouchableOpacity>}
    <Text style={[s.footer, { color: c.textSecondary }]}>Drive safely. We’re with you along the way.</Text>
  </ScrollView>;
}

const s = StyleSheet.create({
  content: { padding: 20, paddingBottom: 32, gap: 16, width: '100%', maxWidth: 680, alignSelf: 'center' },
  flex: { flex: 1, minWidth: 0 }, row: { flexDirection: 'row', alignItems: 'center', gap: 12 }, header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 8 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.3 }, title: { fontSize: 27, lineHeight: 34, fontWeight: '800', marginTop: 8 }, copy: { fontSize: 13, lineHeight: 20, marginTop: 4 },
  avatar: { width: 48, height: 48, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }, avatarText: { fontSize: 21, fontWeight: '800' },
  availability: { padding: 20, borderRadius: 24, gap: 18 }, availabilityIcon: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#2B514A', alignItems: 'center', justifyContent: 'center' },
  overline: { color: '#B9D8D1', fontSize: 10, fontWeight: '800', letterSpacing: 1.1 }, availabilityTitle: { color: '#FFFFFF', fontSize: 21, fontWeight: '800', marginTop: 5 },
  availabilityFooter: { flexDirection: 'row', alignItems: 'center', gap: 9, borderTopWidth: 1, borderColor: '#41655D', paddingTop: 14 }, availabilityCopy: { color: '#D6EAE4', fontSize: 13, lineHeight: 20, flex: 1 }, dot: { width: 7, height: 7, borderRadius: 4 },
  resume: { borderWidth: 1, borderRadius: 18, padding: 16, flexDirection: 'row', gap: 12, alignItems: 'center' }, cardTitle: { fontSize: 16, lineHeight: 22, fontWeight: '700' },
  sectionHeading: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 8 }, sectionTitle: { fontSize: 17, fontWeight: '800' },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 5 }, ratingText: { fontSize: 12, fontWeight: '600' }, metrics: { flexDirection: 'row', gap: 12 }, metric: { flex: 1, minWidth: 0, borderWidth: 1, borderRadius: 20, padding: 16 }, metricValue: { fontSize: 25, lineHeight: 33, fontWeight: '800', marginTop: 18 },
  group: { borderWidth: 1, borderRadius: 22, overflow: 'hidden' }, groupRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, minHeight: 90 }, icon: { width: 44, height: 44, borderRadius: 15, justifyContent: 'center', alignItems: 'center' }, divider: { height: 1, marginHorizontal: 16 }, small: { fontSize: 12, lineHeight: 18, fontWeight: '600' },
  work: { padding: 16, borderRadius: 20, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }, noticeRow: { padding: 16, borderRadius: 18, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }, notice: { padding: 16, borderRadius: 16, fontSize: 14, lineHeight: 21 }, footer: { textAlign: 'center', fontSize: 12, lineHeight: 18, marginVertical: 10 },
});
