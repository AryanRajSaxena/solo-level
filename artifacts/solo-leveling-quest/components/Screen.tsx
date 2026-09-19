import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';

export function Screen({
  children,
  scroll = true,
}: {
  children: React.ReactNode;
  scroll?: boolean;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const content = (
    <View style={[styles.content, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 96 }]}>
      {children}
    </View>
  );
  return (
    <LinearGradient colors={[colors.background, '#0b1525', colors.background]} style={styles.container}>
      {scroll ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </LinearGradient>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  action,
  onAction,
}: {
  eyebrow?: string;
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  const colors = useColors();
  return (
    <View style={styles.sectionHeader}>
      <View>
        {eyebrow ? <Text style={[styles.eyebrow, { color: colors.primary }]}>{eyebrow}</Text> : null}
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>
      </View>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={10}>
          <Text style={[styles.action, { color: colors.primary }]}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function IconButton({
  icon,
  onPress,
  label,
}: {
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
  label: string;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityLabel={label}
      testID={label}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, { backgroundColor: colors.card, borderColor: colors.border }, pressed && styles.pressed]}
    >
      <Feather name={icon} size={18} color={colors.primary} />
    </Pressable>
  );
}

export const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1 },
  content: { paddingHorizontal: 20 },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 2.2, marginBottom: 6 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 },
  sectionTitle: { fontSize: 22, fontWeight: '700', letterSpacing: -0.4 },
  action: { fontSize: 13, fontWeight: '700' },
  iconButton: { width: 40, height: 40, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.7, transform: [{ scale: 0.97 }] },
});