import '@/tasks/locationTask';
import '@/utils/injectWebIcons';
import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { QuestProviderRoot } from '@/context/QuestProviderRoot';
import { SupabaseAuthProvider } from '@/context/SupabaseAuthProvider';
import Feather from '@expo/vector-icons/Feather';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#070b13' } }}>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false, animation: 'fade' }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="walk-quest" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
      <Stack.Screen name="alarm" options={{ headerShown: false, animation: 'fade' }} />
      <Stack.Screen name="pose-tracker" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
      <Stack.Screen name="rank-assessment" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    ...(Platform.OS === 'web' ? {} : Feather.font),
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SupabaseAuthProvider>
      <SafeAreaProvider>
        <ErrorBoundary>
          <QuestProviderRoot>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <KeyboardProvider>
                <RootLayoutNav />
              </KeyboardProvider>
            </GestureHandlerRootView>
          </QuestProviderRoot>
        </ErrorBoundary>
      </SafeAreaProvider>
    </SupabaseAuthProvider>
  );
}
