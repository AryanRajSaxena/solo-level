import { useSignIn, useSignUp } from '@clerk/expo';
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
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');

  return isSignUp ? (
    <SignUpView
      colors={colors}
      insetsTop={insets.top}
      email={email}
      password={password}
      code={code}
      message={message}
      setEmail={setEmail}
      setPassword={setPassword}
      setCode={setCode}
      setMessage={setMessage}
    />
  ) : (
    <SignInView
      colors={colors}
      insetsTop={insets.top}
      email={email}
      password={password}
      code={code}
      message={message}
      setEmail={setEmail}
      setPassword={setPassword}
      setCode={setCode}
      setMessage={setMessage}
    />
  );
}

type AuthViewProps = {
  colors: ReturnType<typeof useColors>;
  insetsTop: number;
  email: string;
  password: string;
  code: string;
  message: string;
  setEmail: (value: string) => void;
  setPassword: (value: string) => void;
  setCode: (value: string) => void;
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
  const { signIn, errors, fetchStatus } = useSignIn();
  const router = useRouter();
  const [needsCode, setNeedsCode] = useState(false);
  const isLoading = fetchStatus === 'fetching';
  const errorText = errors?.fields?.identifier?.message || errors?.fields?.password?.message || props.message;

  const submit = async () => {
    props.setMessage('');
    const result = await signIn.password({ emailAddress: props.email, password: props.password });
    if (result.error) {
      props.setMessage(result.error.message ?? 'Unable to sign in. Check your credentials.');
      return;
    }
    if (signIn.status === 'complete') {
      await signIn.finalize({ navigate: () => router.replace('/(tabs)') });
    } else if (signIn.status === 'needs_client_trust') {
      await signIn.mfa.sendEmailCode();
      setNeedsCode(true);
    } else if (signIn.status === 'needs_second_factor') {
      props.setMessage('A second factor is required for this account.');
    }
  };

  const verify = async () => {
    await signIn.mfa.verifyEmailCode({ code: props.code });
    if (signIn.status === 'complete') {
      await signIn.finalize({ navigate: () => router.replace('/(tabs)') });
    }
  };

  return (
    <AuthFrame {...props} title="Enter the system" subtitle="Your quests, stats, and streak are waiting.">
      {needsCode ? (
        <>
          <Text style={[styles.verifyTitle, { color: props.colors.foreground }]}>Verify your hunter</Text>
          <Field label="EMAIL CODE" value={props.code} onChangeText={props.setCode} placeholder="123456" colors={props.colors} keyboardType="numeric" />
          <PrimaryButton label={isLoading ? 'VERIFYING...' : 'VERIFY CODE'} onPress={() => void verify()} disabled={!props.code || isLoading} colors={props.colors} />
        </>
      ) : (
        <>
          <Field label="EMAIL ADDRESS" value={props.email} onChangeText={props.setEmail} placeholder="you@example.com" colors={props.colors} keyboardType="email-address" />
          <Field label="PASSWORD" value={props.password} onChangeText={props.setPassword} placeholder="Enter your password" colors={props.colors} secureTextEntry />
          <PrimaryButton label={isLoading ? 'LOADING...' : 'SIGN IN'} onPress={() => void submit()} disabled={!props.email || !props.password || isLoading} colors={props.colors} />
        </>
      )}
      {errorText ? <Text style={[styles.error, { color: props.colors.destructive }]}>{errorText}</Text> : null}
      <View style={styles.authLinkRow}>
        <Text style={[styles.linkPrompt, { color: props.colors.mutedForeground }]}>New hunter?</Text>
        <Link href="/(auth)/sign-up" asChild>
          <Pressable><Text style={[styles.link, { color: props.colors.primary }]}>Create an account</Text></Pressable>
        </Link>
      </View>
    </AuthFrame>
  );
}

function SignUpView(props: AuthViewProps) {
  const { signUp, errors, fetchStatus } = useSignUp();
  const router = useRouter();
  const [needsCode, setNeedsCode] = useState(false);
  const isLoading = fetchStatus === 'fetching';
  const errorText = errors?.fields?.emailAddress?.message || errors?.fields?.password?.message || errors?.fields?.code?.message || props.message;

  const submit = async () => {
    props.setMessage('');
    const result = await signUp.password({ emailAddress: props.email, password: props.password });
    if (result.error) {
      props.setMessage(result.error.message ?? 'Unable to create your account.');
      return;
    }
    await signUp.verifications.sendEmailCode();
    setNeedsCode(true);
  };

  const verify = async () => {
    const result = await signUp.verifications.verifyEmailCode({ code: props.code });
    if (result.error) {
      props.setMessage(result.error.message ?? 'That code was not accepted.');
      return;
    }
    if (signUp.status === 'complete') {
      await signUp.finalize({ navigate: () => router.replace('/(tabs)') });
    }
  };

  return (
    <AuthFrame {...props} title={needsCode ? 'Confirm your awakening' : 'Begin your awakening'} subtitle={needsCode ? 'Enter the code sent to your email.' : 'Create an account to keep your progress across devices.'}>
      {needsCode ? (
        <>
          <Text style={[styles.verifyTitle, { color: props.colors.foreground }]}>Email verification</Text>
          <Field label="VERIFICATION CODE" value={props.code} onChangeText={props.setCode} placeholder="123456" colors={props.colors} keyboardType="numeric" />
          <PrimaryButton label={isLoading ? 'VERIFYING...' : 'VERIFY CODE'} onPress={() => void verify()} disabled={!props.code || isLoading} colors={props.colors} />
          <Pressable onPress={() => void signUp.verifications.sendEmailCode()} style={styles.resend}>
            <Text style={[styles.link, { color: props.colors.primary }]}>Send a new code</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Field label="EMAIL ADDRESS" value={props.email} onChangeText={props.setEmail} placeholder="you@example.com" colors={props.colors} keyboardType="email-address" />
          <Field label="PASSWORD" value={props.password} onChangeText={props.setPassword} placeholder="At least 8 characters" colors={props.colors} secureTextEntry />
          <PrimaryButton label={isLoading ? 'CREATING...' : 'CREATE ACCOUNT'} onPress={() => void submit()} disabled={!props.email || !props.password || isLoading} colors={props.colors} />
          <View nativeID="clerk-captcha" />
        </>
      )}
      {errorText ? <Text style={[styles.error, { color: props.colors.destructive }]}>{errorText}</Text> : null}
      <View style={styles.authLinkRow}>
        <Text style={[styles.linkPrompt, { color: props.colors.mutedForeground }]}>Already awakened?</Text>
        <Link href="/(auth)/sign-in" asChild>
          <Pressable><Text style={[styles.link, { color: props.colors.primary }]}>Sign in</Text></Pressable>
        </Link>
      </View>
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
  verifyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 18 },
  resend: { alignItems: 'center', marginTop: 16 },
});