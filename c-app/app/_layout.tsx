import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../src/store/auth';
import { registerForPushNotificationsAsync } from '../src/lib/notifications';
import { useTheme } from '../src/constants/theme';
import { cmsText, fetchCms, type CmsPayload } from '../src/lib/cms';

export default function RootLayout() {
  const { token, isLoading, checkAuth } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const [cms, setCms] = useState<CmsPayload>({});
  const [cmsLoading, setCmsLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    registerForPushNotificationsAsync().then(pushToken => {
        if (pushToken && token) {
            if (__DEV__) console.log('Push token registered:', pushToken);
        }
    });
  }, [token]);

  useEffect(() => {
    fetchCms('customer-mobile')
      .then(setCms)
      .catch(() => setCms({}))
      .finally(() => setCmsLoading(false));
  }, []);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === 'login';

    if (!token && !inAuthGroup) {
      router.replace('/login');
    } else if (token && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [token, isLoading, segments, router]);

  if (isLoading || cmsLoading) {
    const splashTitle = cmsText(cms, 'splash', 'main', 'title', 'Turiya Mobility');
    const splashSubtitle = cmsText(cms, 'splash', 'main', 'subtitle', 'Tours - Rides - Rentals');
    return (
      <SafeAreaProvider>
        <StatusBar style="light" />
        <View style={styles.splash}>
          <View style={styles.logoArea}>
            <Image source={require('../assets/images/turiya-mark-white.png')} style={styles.splashImage} contentFit="contain" />
            <Text style={styles.splashTitle}>{splashTitle}</Text>
            <Text style={styles.splashTagline}>{splashSubtitle}</Text>
          </View>
          <View style={styles.bottomArea}>
            <ActivityIndicator color="rgba(255,255,255,0.7)" size="small" />
            <Text style={styles.splashLoading}>Loading your experience…</Text>
          </View>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView edges={['top']} style={[styles.app, { backgroundColor: colors.background }]}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="login" options={{ animation: 'fade' }} />
          <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
          <Stack.Screen name="ride-booking" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="ride-details" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="service-activity" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="tour-details" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="rental-details" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="place-details" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="wallet" options={{ title: 'Wallet' }} />
          <Stack.Screen name="tour-checkout" options={{ title: 'Tour Checkout' }} />
          <Stack.Screen name="rental-checkout" options={{ title: 'Rent a Car' }} />
          <Stack.Screen name="tour-share" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="shared-tour" options={{ animation: 'slide_from_right' }} />
        </Stack>
        <StatusBar style={isDark ? 'light' : 'dark'} />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1 },
  splash: {
    flex: 1,
    backgroundColor: '#041C43',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 120,
    paddingBottom: 60,
  },
  logoArea: { alignItems: 'center', gap: 0 },
  logoRing: {
    width: 100,
    height: 100,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  logoMark: {
    width: 74,
    height: 74,
    borderRadius: 24,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoLetter: { color: '#0F766E', fontSize: 36, fontWeight: '900' },
  splashImage: { width: 220, height: 100 },
  splashTitle: {
    marginTop: 28,
    color: '#fff',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  splashTagline: {
    marginTop: 8,
    color: 'rgba(255,255,255,0.65)',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  bottomArea: { alignItems: 'center', gap: 10 },
  splashLoading: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '500',
  },
});
