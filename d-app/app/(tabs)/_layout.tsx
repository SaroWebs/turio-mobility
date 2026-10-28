import { Tabs } from 'expo-router';
import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, Briefcase, Wallet, Clock, User } from 'lucide-react-native';
import { useAuthStore } from '../../src/store/auth';
import { canUseDriverServices } from '../../src/lib/driver-access';
import { useTheme } from '../../src/constants/theme';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const bottomPadding = Math.max(insets.bottom, 8);
  const servicesAvailable = useAuthStore((state) => canUseDriverServices(state.user));

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarActiveBackgroundColor: colors.brandSoft,
        headerShown: false,
        tabBarLabelPosition: 'below-icon',
        tabBarStyle: {
          height: 64 + bottomPadding,
          paddingTop: 8,
          paddingHorizontal: 8,
          paddingBottom: bottomPadding,
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          lineHeight: 16,
          marginTop: 0,
        },
        tabBarItemStyle: {
          borderRadius: 16,
          marginHorizontal: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Home color={color} size={22} strokeWidth={focused ? 2.5 : 2} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Work',
          href: servicesAvailable ? undefined : null,
          tabBarIcon: ({ color, focused }) => (
            <Briefcase color={color} size={22} strokeWidth={focused ? 2.5 : 2} />
          ),
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: 'Wallet',
          tabBarIcon: ({ color, focused }) => (
            <Wallet color={color} size={22} strokeWidth={focused ? 2.5 : 2} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Trips',
          tabBarIcon: ({ color, focused }) => (
            <Clock color={color} size={22} strokeWidth={focused ? 2.5 : 2} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Account',
          tabBarIcon: ({ color, focused }) => (
            <User color={color} size={22} strokeWidth={focused ? 2.5 : 2} />
          ),
        }}
      />
    </Tabs>
  );
}
