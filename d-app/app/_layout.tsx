import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../src/store/auth';
import { cmsText, fetchCms, type CmsPayload } from '../src/lib/cms';
import { canUseDriverServices } from '../src/lib/driver-access';

export default function RootLayout() {
  const { token, user, isLoading, checkAuth } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();
  const [cms, setCms] = useState<CmsPayload>({});
  const [cmsLoading, setCmsLoading] = useState(true);
  const serviceRouteBlocked = !canUseDriverServices(user)
    && (segments[0] === 'active-ride' || segments[0] === 'service-task');

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    fetchCms('driver-app')
      .then(setCms)
      .catch(() => setCms({}))
      .finally(() => setCmsLoading(false));
  }, []);

  useEffect(() => {
    if (isLoading) return;
    const inAuthGroup = segments[0] === 'login' || segments[0] === 'register';
    if (!token && !inAuthGroup) {
      router.replace('/login');
    } else if (token && inAuthGroup) {
      router.replace('/(tabs)');
    } else if (token && serviceRouteBlocked) {
      router.replace('/(tabs)');
    }
  }, [token, isLoading, segments, router, serviceRouteBlocked]);

  const inAuthGroup = segments[0] === 'login' || segments[0] === 'register';
  const redirectPending = (!token && !inAuthGroup) || (Boolean(token) && (inAuthGroup || serviceRouteBlocked));

  // Do not mount protected tab screens during the render in which the auth
  // redirect is being scheduled; those screens would otherwise issue 401s.
  if (isLoading || cmsLoading || redirectPending) {
    const splashTitle = cmsText(cms, 'splash', 'main', 'title', 'Turiya Mobility Driver');
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
            <ActivityIndicator color="rgba(255,255,255,0.6)" size="small" />
            <Text style={styles.splashLoading}>Connecting to driver network…</Text>
          </View>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView edges={['top']} style={styles.app}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="login" options={{ animation: 'fade' }} />
          <Stack.Screen name="register" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
          <Stack.Screen name="active-ride" options={{ presentation: 'fullScreenModal' }} />
          <Stack.Screen name="service-task" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="history/[kind]/[id]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="my-car" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="documents" options={{ animation: 'slide_from_right' }} />
        </Stack>
        <StatusBar style="auto" />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: '#f4f7f6' },
  splash: {
    flex: 1,
    backgroundColor: '#041C43',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 130,
    paddingBottom: 60,
  },
  logoArea: { alignItems: 'center', gap: 0 },
  logoRing: {
    width: 104,
    height: 104,
    borderRadius: 34,
    borderWidth: 2,
    borderColor: 'rgba(15,118,110,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15,118,110,0.12)',
  },
  logoMark: {
    width: 76,
    height: 76,
    borderRadius: 26,
    backgroundColor: '#0f766e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoLetter: { color: '#fff', fontSize: 34, fontWeight: '900' },
  splashImage: { width: 220, height: 100 },
  splashTitle: {
    marginTop: 28,
    color: '#fff',
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  splashTagline: {
    marginTop: 8,
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  bottomArea: { alignItems: 'center', gap: 10 },
  splashLoading: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontWeight: '500',
  },
});
