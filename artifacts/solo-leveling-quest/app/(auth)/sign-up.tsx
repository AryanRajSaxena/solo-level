import React from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '@clerk/expo';
import { AuthScreen } from '@/components/AuthScreen';

export default function SignUpScreen() {
  const { isSignedIn } = useAuth();
  if (isSignedIn) return <Redirect href="/(tabs)" />;
  return <AuthScreen mode="sign-up" />;
}