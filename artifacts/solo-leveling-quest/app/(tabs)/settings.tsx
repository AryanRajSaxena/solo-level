import { Feather } from '@expo/vector-icons';
import { useClerk } from '@clerk/expo';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Screen, SectionHeader } from '@/components/Screen';
import { DAY_LABELS, Weekday, useQuestContext } from '@/context/QuestContext';
import { useColors } from '@/hooks/useColors';

export default function SettingsScreen() {
  const colors = useColors();
  const router = useRouter();
  const { signOut } = useClerk();
  const { restDays, toggleRestDay, scheduleReminders, resetPenaltyForDemo } = useQuestContext();
  const [reminders, setReminders] = useState(false);

  const toggleReminders = async (value: boolean) => {
    if (value) {
      const enabled = await scheduleReminders();
      setReminders(enabled);
      if (!enabled) Alert.alert('Notifications are off', 'Allow notifications in your device settings to enable the two daily nudges.');
    } else {
      setReminders(false);
    }
  };

  const simulatePenalty = () => {
    resetPenaltyForDemo();
    Alert.alert('Lockdown activated', 'The in-app penalty is active for 24 hours. Your streak was reset and 100 XP was deducted.');
  };

  return (
    <Screen>
      <SectionHeader eyebrow="SYSTEM CONFIG" title="Settings" />
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.row}>
          <View style={[styles.settingIcon, { backgroundColor: colors.accent }]}><Feather name="bell" size={17} color={colors.primary} /></View>
          <View style={styles.copy}><Text style={[styles.settingTitle, { color: colors.foreground }]}>Daily reminders</Text><Text style={[styles.settingDetail, { color: colors.mutedForeground }]}>Morning kickoff at 07:30 · deadline warning at 21:00</Text></View>
          <Switch value={reminders} onValueChange={toggleReminders} trackColor={{ false: colors.muted, true: colors.primary }} thumbColor={colors.foreground} />
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader eyebrow="RECOVERY PLAN" title="Rest days" />
        <Text style={[styles.helper, { color: colors.mutedForeground }]}>Rest days pause all quests. The weekly raid respects your recovery plan.</Text>
        <View style={styles.dayGrid}>
          {DAY_LABELS.map((label, index) => {
            const selected = restDays.includes(index as Weekday);
            return (
              <Pressable key={label} onPress={() => toggleRestDay(index as Weekday)} style={[styles.day, { backgroundColor: selected ? colors.primary : colors.card, borderColor: selected ? colors.primary : colors.border }]}>
                <Text style={[styles.dayText, { color: selected ? colors.primaryForeground : colors.mutedForeground }]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader eyebrow="PENALTY PROTOCOL" title="Social lockdown" />
        <View style={[styles.penaltyCard, { borderColor: colors.destructive, backgroundColor: '#291827' }]}>
          <Feather name="shield" color={colors.destructive} size={19} />
          <View style={styles.copy}><Text style={[styles.settingTitle, { color: colors.foreground }]}>Failing a daily quest</Text><Text style={[styles.settingDetail, { color: colors.mutedForeground }]}>Activates an in-app 24-hour lockdown screen, resets your streak, and removes 100 XP. Native social app blocking is planned for a later build.</Text></View>
        </View>
        <Pressable onPress={simulatePenalty} style={[styles.demoButton, { borderColor: colors.destructive }]}>
          <Feather name="alert-triangle" size={16} color={colors.destructive} />
          <Text style={[styles.demoText, { color: colors.destructive }]}>SIMULATE FAILED DAY</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Pressable onPress={() => void signOut(() => router.replace('/(auth)/sign-in'))} style={[styles.signOut, { borderColor: colors.border }]}>
          <Feather name="log-out" size={17} color={colors.mutedForeground} />
          <Text style={[styles.signOutText, { color: colors.mutedForeground }]}>SIGN OUT</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 17, padding: 14 },
  row: { flexDirection: 'row', alignItems: 'center' },
  settingIcon: { width: 37, height: 37, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  copy: { flex: 1 },
  settingTitle: { fontSize: 13, fontWeight: '700' },
  settingDetail: { fontSize: 11, lineHeight: 16, marginTop: 4 },
  section: { marginTop: 28 },
  helper: { fontSize: 13, lineHeight: 20, marginTop: -4, marginBottom: 15 },
  dayGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  day: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  dayText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  penaltyCard: { flexDirection: 'row', gap: 11, borderWidth: 1, borderRadius: 17, padding: 14 },
  demoButton: { height: 48, borderWidth: 1, borderRadius: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 11 },
  demoText: { fontSize: 10, fontWeight: '800', letterSpacing: 1.1 },
  signOut: { height: 48, borderWidth: 1, borderRadius: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  signOutText: { fontSize: 11, fontWeight: '800', letterSpacing: 1.1 },
});