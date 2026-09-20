import React from 'react';
import { Redirect } from 'expo-router';
import { useSupabaseAuth } from '@/context/SupabaseAuthProvider';
import { AuthScreen } from '@/components/AuthScreen';

export default function SignUpScreen() {
  const { isSignedIn } = useSupabaseAuth();
  if (isSignedIn) return <Redirect href="/(tabs)" />;
  return <AuthScreen mode="sign-up" />;
}