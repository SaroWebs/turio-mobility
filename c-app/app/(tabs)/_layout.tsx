import { Tabs } from 'expo-router';
import { Home, Compass, CalendarCheck2, User } from 'lucide-react-native';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FloatingShadow, Radius, useTheme } from '../../src/constants/theme';

export default function TabLayout() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 10);

  return (
    <Tabs screenOptions={{
      tabBarActiveTintColor: isDark ? '#FFFFFF' : '#0F172A',
      tabBarInactiveTintColor: colors.textMuted,
      headerShown: false,
      tabBarLabelPosition: 'below-icon',
      tabBarStyle: {
        position: 'absolute',
        bottom: Platform.OS === 'ios' ? bottomPadding : 12,
        left: 16,
        right: 16,
        borderRadius: Radius.sheet,
        backgroundColor: isDark ? 'rgba(24, 24, 27, 0.96)' : 'rgba(255, 255, 255, 0.96)',
        borderTopWidth: 0,
        borderWidth: 1,
        borderColor: colors.border,
        height: 64,
        paddingBottom: 8,
        paddingTop: 8,
        ...FloatingShadow,
      },
      tabBarLabelStyle: {
        fontSize: 11,
        fontWeight: '700',
        lineHeight: 14,
        marginTop: 2,
      },
    }}>
      <Tabs.Screen name="index" options={{
        title: 'Home',
        tabBarIcon: ({ color, focused }) => (
          <Home color={color} size={20} strokeWidth={focused ? 2.6 : 2} />
        ),
      }} />
      <Tabs.Screen name="services" options={{
        title: 'Services',
        tabBarIcon: ({ color, focused }) => (
          <Compass color={color} size={20} strokeWidth={focused ? 2.6 : 2} />
        ),
      }} />
      <Tabs.Screen name="activity" options={{
        title: 'Bookings',
        tabBarIcon: ({ color, focused }) => (
          <CalendarCheck2 color={color} size={20} strokeWidth={focused ? 2.6 : 2} />
        ),
      }} />
      <Tabs.Screen name="profile" options={{
        title: 'Account',
        tabBarIcon: ({ color, focused }) => (
          <User color={color} size={20} strokeWidth={focused ? 2.6 : 2} />
        ),
      }} />

      {/* Hide internal modal or helper screens from tab bar */}
      <Tabs.Screen name="rentals" options={{ href: null }} />
      <Tabs.Screen name="tours" options={{ href: null }} />
      <Tabs.Screen name="explore" options={{ href: null }} />
    </Tabs>
  );
}
