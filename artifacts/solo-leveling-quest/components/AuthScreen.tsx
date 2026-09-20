import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { Link, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';

type AuthMode = 'sign-in' | 'sign-up';

export function AuthScreen({ mode }: { mode: AuthMode }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isSignUp = mode === 'sign-up';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  return isSignUp ? (
    <SignUpView
      colors={colors}
      insetsTop={insets.top}
      email={email}
      password={password}
      message={message}
      setEmail={setEmail}
      setPassword={setPassword}
      setMessage={setMessage}
    />
  ) : (
    <SignInView
      colors={colors}
      insetsTop={insets.top}
      email={email}
      password={password}
      message={message}
      setEmail={setEmail}
      setPassword={setPassword}
      setMessage={setMessage}
    />
  );
}

type AuthViewProps = {
  colors: ReturnType<typeof useColors>;
  insetsTop: number;
  email: string;
  password: string;
  message: string;
  setEmail: (value: string) => void;
  setPassword: (value: string) => void;
  setMessage: (value: string) => void;
};

function AuthFrame({
  children,
  colors,
  insetsTop,
  title,
  subtitle,
}: AuthViewProps & { children: React.ReactNode; title: string; subtitle: string }) {
  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insetsTop + 38 }]}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={[styles.systemBadge, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Text style={[styles.systemDot, { color: colors.primary }]}>◆</Text>
          <Text style={[styles.systemLabel, { color: colors.mutedForeground }]}>SYSTEM // ACCESS GATE</Text>
        </View>
        <Text style={[styles.logo, { color: colors.primary }]}>QUEST</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{subtitle}</Text>
        <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>{children}</View>
      </ScrollView>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  colors,
  secureTextEntry = false,
  keyboardType = 'default',
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  colors: ReturnType<typeof useColors>;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric';
}) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        secureTextEntry={secureTextEntry}
        autoCapitalize="none"
        keyboardType={keyboardType}
        style={[styles.input, { borderColor: colors.border, backgroundColor: colors.input, color: colors.foreground }]}
      />
    </View>
  );
}

function PrimaryButton({ label, onPress, disabled, colors }: { label: string; onPress: () => void; disabled?: boolean; colors: ReturnType<typeof useColors> }) {
  return (
    <Pressable
      testID={label}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.primary }, disabled && styles.disabled, pressed && styles.pressed]}
    >
      <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>{label}</Text>
    </Pressable>
  );
}

function SignInView(props: AuthViewProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const submit = async () => {
    props.setMessage('');
    if (!isSupabaseConfigured) {
      props.setMessage('SYSTEM NOTICE: Supabase keys are not configured yet. Please update .env with your project URL and Anon Key.');
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: props.email,
        password: props.password,
      });
      if (error) {
        props.setMessage(error.message ?? 'Unable to sign in. Check your credentials.');
      } else {
        router.replace('/(tabs)');
      }
    } catch {
      props.setMessage('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthFrame {...props} title="Enter the system" subtitle="Your quests, stats, and streak are waiting.">
      <Field label="EMAIL ADDRESS" value={props.email} onChangeText={props.setEmail} placeholder="you@example.com" colors={props.colors} keyboardType="email-address" />
      <Field label="PASSWORD" value={props.password} onChangeText={props.setPassword} placeholder="Enter your password" colors={props.colors} secureTextEntry />
      <PrimaryButton label={isLoading ? 'LOADING...' : 'SIGN IN'} onPress={() => void submit()} disabled={!props.email || !props.password || isLoading} colors={props.colors} />
      {props.message ? <Text style={[styles.error, { color: props.colors.destructive }]}>{props.message}</Text> : null}
      <View style={styles.authLinkRow}>
        <Text style={[styles.linkPrompt, { color: props.colors.mutedForeground }]}>New hunter?</Text>
        <Link href="/(auth)/sign-up" style={[styles.link, { color: props.colors.primary }]}>
          Create an account
        </Link>
      </View>
    </AuthFrame>
  );
}

function SignUpView(props: AuthViewProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  const submit = async () => {
    props.setMessage('');
    if (!isSupabaseConfigured) {
      props.setMessage('SYSTEM NOTICE: Supabase keys are not configured yet. Please update .env with your project URL and Anon Key.');
      return;
    }
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: props.email,
        password: props.password,
      });
      if (error) {
        props.setMessage(error.message ?? 'Unable to create your account.');
      } else if (data.session) {
        // Auto-confirmed — navigate directly
        router.replace('/(tabs)');
      } else {
        // Email confirmation required
        setConfirmationSent(true);
        props.setMessage('Check your email for a confirmation link to complete your awakening.');
      }
    } catch {
      props.setMessage('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthFrame
      {...props}
      title={confirmationSent ? 'Confirm your awakening' : 'Begin your awakening'}
      subtitle={confirmationSent ? 'A verification link has been sent to your email.' : 'Create an account to keep your progress across devices.'}
    >
      {confirmationSent ? (
        <>
          <Text style={[styles.verifyTitle, { color: props.colors.foreground }]}>Verification sent</Text>
          <Text style={[styles.verifyDetail, { color: props.colors.mutedForeground }]}>
            Open the confirmation link in your email, then return here and sign in.
          </Text>
          <Pressable
            onPress={() => router.replace('/(auth)/sign-in')}
            style={[styles.primaryButton, { backgroundColor: props.colors.primary, marginTop: 16 }]}
          >
            <Text style={[styles.primaryButtonText, { color: props.colors.primaryForeground }]}>GO TO SIGN IN</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Field label="EMAIL ADDRESS" value={props.email} onChangeText={props.setEmail} placeholder="you@example.com" colors={props.colors} keyboardType="email-address" />
          <Field label="PASSWORD" value={props.password} onChangeText={props.setPassword} placeholder="At least 6 characters" colors={props.colors} secureTextEntry />
          <PrimaryButton label={isLoading ? 'CREATING...' : 'CREATE ACCOUNT'} onPress={() => void submit()} disabled={!props.email || !props.password || isLoading} colors={props.colors} />
        </>
      )}
      {props.message && !confirmationSent ? <Text style={[styles.error, { color: props.colors.destructive }]}>{props.message}</Text> : null}
      {!confirmationSent && (
        <View style={styles.authLinkRow}>
          <Text style={[styles.linkPrompt, { color: props.colors.mutedForeground }]}>Already awakened?</Text>
          <Link href="/(auth)/sign-in" style={[styles.link, { color: props.colors.primary }]}>
            Sign in
          </Link>
        </View>
      )}
    </AuthFrame>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingBottom: 48 },
  systemBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, borderWidth: 1, gap: 7 },
  systemDot: { fontSize: 11 },
  systemLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.7 },
  logo: { marginTop: 48, fontSize: 13, letterSpacing: 5, fontWeight: '800' },
  title: { marginTop: 10, fontSize: 32, fontWeight: '800', letterSpacing: -0.8 },
  subtitle: { marginTop: 10, fontSize: 15, lineHeight: 22 },
  formCard: { marginTop: 30, borderWidth: 1, borderRadius: 22, padding: 18 },
  field: { marginBottom: 16 },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 8 },
  input: { height: 52, borderWidth: 1, borderRadius: 13, paddingHorizontal: 14, fontSize: 15 },
  primaryButton: { height: 52, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  primaryButtonText: { fontSize: 13, letterSpacing: 1.2, fontWeight: '800' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.985 }] },
  error: { marginTop: 13, fontSize: 12, lineHeight: 18 },
  authLinkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 22 },
  linkPrompt: { fontSize: 13 },
  link: { fontSize: 13, fontWeight: '700' },
  verifyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  verifyDetail: { fontSize: 14, lineHeight: 21 },
  resend: { alignItems: 'center', marginTop: 16 },
});