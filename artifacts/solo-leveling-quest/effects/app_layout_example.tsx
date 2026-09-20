/**
 * app/_layout.tsx  (Expo Router root layout)
 *
 * This file shows how to wire the onboarding screen into your app.
 * It handles three states:
 *   1. Loading  — checking AsyncStorage + Clerk auth
 *   2. First-time user — shows OnboardingScreen
 *   3. Returning user — goes straight to main tabs
 */

import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { ClerkProvider, useAuth, useUser } from '@clerk/clerk-expo';
import * as SecureStore from 'expo-secure-store';

import { OnboardingScreen } from '../components/OnboardingScreen';
import { useFirstTimeUser } from '../hooks/useFirstTimeUser';

// ─────────────────────────────────────────────
// Token cache for Clerk (Expo recommended setup)
// ─────────────────────────────────────────────
const tokenCache = {
  async getToken(key: string) {
    try { return SecureStore.getItemAsync(key); } catch { return null; }
  },
  async saveToken(key: string, value: string) {
    try { await SecureStore.setItemAsync(key, value); } catch {}
  },
};

// ─────────────────────────────────────────────
// Inner layout — runs inside ClerkProvider
// ─────────────────────────────────────────────
function RootLayout() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user }                 = useUser();
  const router                   = useRouter();
  const segments                 = useSegments();

  const { isFirstTime, isLoading, completeOnboarding } = useFirstTimeUser();

  // Redirect unauthenticated users to sign-in
  useEffect(() => {
    if (!isLoaded) return;
    const inAuthGroup = segments[0] === '(auth)';

    if (!isSignedIn && !inAuthGroup) {
      router.replace('/(auth)/sign-in');
    } else if (isSignedIn && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [isLoaded, isSignedIn, segments]);

  // ── Loading state ──────────────────────────
  if (!isLoaded || isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#c9a227" size="large" />
      </View>
    );
  }

  // ── Signed-in + first time → onboarding ───
  if (isSignedIn && isFirstTime) {
    const handleComplete = async (hunterName: string) => {
      // 1. Save to AsyncStorage + init hunter data
      await completeOnboarding(hunterName);

      // 2. Optionally sync to your FastAPI backend
      // await api.post('/hunters', { userId: user.id, name: hunterName });

      // 3. Navigate to main app
      router.replace('/(tabs)');
    };

    return <OnboardingScreen onComplete={handleComplete} />;
  }

  // ── Normal app shell ───────────────────────
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)"  />
      <Stack.Screen name="(auth)"  />
    </Stack>
  );
}

// ─────────────────────────────────────────────
// Root export — wraps everything in ClerkProvider
// ─────────────────────────────────────────────
export default function Layout() {
  return (
    <ClerkProvider
      publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!}
      tokenCache={tokenCache}
    >
      <RootLayout />
    </ClerkProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#050508',
  },
});

/**
 * ─────────────────────────────────────────────
 * If you use React Navigation instead of Expo Router:
 * ─────────────────────────────────────────────
 *
 * const App = () => {
 *   const { isFirstTime, isLoading, completeOnboarding } = useFirstTimeUser();
 *   const { isSignedIn } = useAuth();
 *
 *   if (isLoading) return <SplashScreen />;
 *
 *   if (isSignedIn && isFirstTime) {
 *     return (
 *       <OnboardingScreen
 *         onComplete={async (name) => {
 *           await completeOnboarding(name);
 *           // React Navigation will re-render with isFirstTime=false
 *         }}
 *       />
 *     );
 *   }
 *
 *   return <MainNavigator />;
 * };
 */
