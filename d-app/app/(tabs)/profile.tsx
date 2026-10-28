import React, { useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView,
  Alert, Linking, Platform
} from 'react-native';
import { useAuthStore } from '../../src/store/auth';
import api from '../../src/lib/api';
import { 
  Settings, 
  LogOut, 
  ChevronRight, 
  Star, 
  Car, 
  FileCheck2,
  CheckCircle2
} from 'lucide-react-native';
import { Href, useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../../src/constants/theme';
import { canUseDriverServices } from '../../src/lib/driver-access';

const MenuItem = ({ icon: Icon, title, subtitle, onPress, color = '#64748b', colors: c }: any) => (
  <TouchableOpacity accessibilityRole="button" style={[styles.menuItem, { backgroundColor: c.surface, borderColor: c.border }]} onPress={onPress}>
    <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
      <Icon size={20} color={color} />
    </View>
    <View style={styles.menuText}>
      <Text style={[styles.menuTitle, { color: c.text }]}>{title}</Text>
      {subtitle && <Text style={[styles.menuSubtitle, { color: c.textSecondary }]}>{subtitle}</Text>}
    </View>
    <ChevronRight size={16} color={c.textMuted} />
  </TouchableOpacity>
);

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const [stats, setStats] = useState<any>(null);
  // Build 2-letter initials like customer app (first letter of each word, max 2)
  const initials = (user?.name || 'Driver').split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() || '').join('');

  useFocusEffect(
    useCallback(() => {
      let active = true;
      api.get('/dashboard').then((res) => {
        if (active && res.data?.success) {
          setStats(res.data.stats || null);
        }
      }).catch(() => undefined);
      return () => { active = false; };
    }, [])
  );

  const ratingDisplay = (user as any)?.rating ? Number((user as any).rating).toFixed(1) : (stats?.rating ? Number(stats.rating).toFixed(1) : 'New');
  const ridesCountDisplay = stats?.completed_rides !== undefined ? stats.completed_rides : ((user as any)?.total_rides || 0);

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to exit?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', onPress: logout, style: 'destructive' }
    ]);
  };



  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.eyebrow, { color: colors.brand }]}>YOUR DRIVER ACCOUNT</Text>
        <Text accessibilityRole="header" style={[styles.pageTitle, { color: colors.text }]}>Account</Text>
        <View style={[styles.header, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.avatarContainer}>
             <View style={[styles.avatar, { backgroundColor: isDark ? colors.brandSoft : '#f1f5f9', borderColor: colors.border }]}>
                <Text style={[styles.avatarText, { color: colors.brand }]}>{initials || 'DR'}</Text>
             </View>
             {canUseDriverServices(user) && <View style={[styles.verifiedBadge, { backgroundColor: colors.surface }]}>
                <CheckCircle2 color="#fff" size={12} fill="#10b981" />
             </View>}
          </View>
          <Text style={[styles.userName, { color: colors.text }]}>{user?.name || 'Driver Name'}</Text>
          <Text style={[styles.userPhone, { color: colors.textSecondary }]}>{user?.phone ? `+91 ${user.phone}` : ''}</Text>
          
          <View style={styles.ratingRow}>
            <View style={styles.ratingBadge}>
              <Star size={14} color="#f59e0b" fill="#f59e0b" />
              <Text style={styles.ratingText}>{ratingDisplay}</Text>
            </View>
            <View style={styles.dot} />
            <Text style={styles.ridesCount}>{ridesCountDisplay} {ridesCountDisplay === 1 ? 'Ride' : 'Rides'}</Text>
          </View>
        </View>

        <TouchableOpacity style={[styles.carCard, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => router.push('/my-car' as Href)}>
          <Car color={colors.brand} size={24} />
          <View style={styles.carInfo}>
            <Text style={[styles.carModel, { color: colors.text }]}>My car</Text>
            <Text style={[styles.carType, { color: colors.textSecondary }]}>Details, approval, and service readiness</Text>
          </View>
          <ChevronRight size={16} color={colors.textMuted} />
        </TouchableOpacity>

        <View style={styles.section}>
          <MenuItem icon={FileCheck2} title="Documents" subtitle="View, upload, and manage your driver documents" onPress={() => router.push('/documents')} color="#0f766e" colors={colors} />
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Preferences & access</Text>
          <MenuItem icon={Settings} title="Device settings" subtitle="Location permissions and notifications"
            onPress={() => {
              if (Platform.OS === 'web') Alert.alert('Browser permissions', 'Open the site controls beside the address bar to manage location and notification permissions.');
              else void Linking.openSettings().catch(() => Alert.alert('Settings unavailable', 'Open your device settings and select Turiya Mobility Driver.'));
            }} color={colors.brand} colors={colors} />
          <MenuItem 
            icon={LogOut} 
            title="Logout" 
            onPress={handleLogout}
            color="#ef4444"
            colors={colors}
          />
        </View>

        <Text style={[styles.version, { color: colors.textMuted }]}>Turiya Mobility Driver Alpha v1.0.2</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40, width: '100%', maxWidth: 680, alignSelf: 'center' },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.3, marginTop: 8 },
  pageTitle: { fontSize: 28, fontWeight: '800', marginTop: 8, marginBottom: 22 },
  header: { alignItems: 'center', padding: 24, borderWidth: 1, borderRadius: 24, backgroundColor: '#fff' },
  avatarContainer: { position: 'relative' },
  avatar: { 
    width: 80, 
    height: 80, 
    borderRadius: 40, 
    backgroundColor: '#f1f5f9', 
    justifyContent: 'center', 
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5
  },
  avatarText: { fontSize: 32, fontWeight: '800', color: '#475569' },
  verifiedBadge: { 
    position: 'absolute', 
    bottom: 2, 
    right: 2, 
    backgroundColor: '#fff', 
    borderRadius: 10, 
    padding: 2 
  },
  userName: { fontSize: 22, fontWeight: '800', color: '#1e293b', marginTop: 16 },
  userPhone: { fontSize: 14, color: '#64748b', marginTop: 4 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 8 },
  ratingBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#fffbeb', 
    paddingHorizontal: 8, 
    paddingVertical: 4, 
    borderRadius: 8, 
    gap: 4 
  },
  ratingText: { fontSize: 14, fontWeight: '700', color: '#b45309' },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#cbd5e1' },
  ridesCount: { fontSize: 13, color: '#94a3b8', fontWeight: '500' },
  carCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginVertical: 20,
    padding: 20,
    borderRadius: 20,
    gap: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9'
  },
  carInfo: { flex: 1 },
  carModel: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  carType: { fontSize: 12, color: '#64748b', marginTop: 2 },
  section: { marginTop: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 12, marginLeft: 4 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    minHeight: 78, borderWidth: 1,
  },
  iconContainer: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  menuText: { flex: 1, marginLeft: 12 },
  menuTitle: { fontSize: 15, fontWeight: '600', color: '#334155' },
  menuSubtitle: { lineHeight: 20, fontSize: 13, color: '#94a3b8', marginTop: 2 },
  version: { textAlign: 'center', color: '#cbd5e1', fontSize: 12, marginTop: 32 }
});
