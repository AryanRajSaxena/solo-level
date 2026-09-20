import { Feather } from '@expo/vector-icons';
import { useSupabaseAuth } from '@/context/SupabaseAuthProvider';
import { useRouter } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, TouchableOpacity, View, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Screen, SectionHeader } from '@/components/Screen';
import { DAY_LABELS, Weekday, useQuestContext } from '@/context/QuestContext';
import { useColors } from '@/hooks/useColors';

const ALARM_SETTINGS_KEY = '@solo-leveling-quest/alarm-settings-v1';

export default function SettingsScreen() {
  const colors = useColors();
  const router = useRouter();
  const { signOut } = useSupabaseAuth();
  const { restDays, toggleRestDay, notificationPreferences, updateNotificationPreferences, resetPenaltyForDemo } = useQuestContext();
  const [isSigningOut, setIsSigningOut] = useState(false);

  // Alarm settings state
  const [alarmEnabled, setAlarmEnabled] = useState(true);
  const [alarmHour, setAlarmHour] = useState(6);
  const [alarmMinute, setAlarmMinute] = useState(30);
  const [testCountdown, setTestCountdown] = useState<number | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const stored = await AsyncStorage.getItem(ALARM_SETTINGS_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (typeof parsed.enabled === 'boolean') setAlarmEnabled(parsed.enabled);
          if (typeof parsed.hour === 'number') setAlarmHour(parsed.hour);
          if (typeof parsed.minute === 'number') setAlarmMinute(parsed.minute);
        }
      } catch {}
    })();
  }, []);

  const saveAlarmSettings = async (enabled: boolean, hour: number, minute: number) => {
    setAlarmEnabled(enabled);
    setAlarmHour(hour);
    setAlarmMinute(minute);
    try {
      await AsyncStorage.setItem(
        ALARM_SETTINGS_KEY,
        JSON.stringify({ enabled, hour, minute })
      );
    } catch {}
  };

  const handleHourChange = (delta: number) => {
    const nextHour = (alarmHour + delta + 24) % 24;
    void saveAlarmSettings(alarmEnabled, nextHour, alarmMinute);
  };

  const handleMinuteChange = (delta: number) => {
    const nextMinute = (alarmMinute + delta + 60) % 60;
    void saveAlarmSettings(alarmEnabled, alarmHour, nextMinute);
  };

  // Test Alarm with 10s delay
  const handleTestAlarm10s = () => {
    setTestCountdown(10);
  };

  useEffect(() => {
    if (testCountdown === null) return;
    if (testCountdown <= 0) {
      setTestCountdown(null);
      router.push('/alarm' as any);
      return;
    }
    const timer = setTimeout(() => {
      setTestCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => clearTimeout(timer);
  }, [testCountdown, router]);

  // Format next alarm display
  const formatTime = (h: number, m: number) => {
    const hStr = h.toString().padStart(2, '0');
    const mStr = m.toString().padStart(2, '0');
    return `${hStr}:${mStr}`;
  };

  const getNextAlarmText = () => {
    if (!alarmEnabled) return 'Alarm is currently disabled';
    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();
    const alarmMins = alarmHour * 60 + alarmMinute;
    if (alarmMins > currentMins) {
      return `Next alarm: Today at ${formatTime(alarmHour, alarmMinute)}`;
    }
    return `Next alarm: Tomorrow at ${formatTime(alarmHour, alarmMinute)}`;
  };

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      await signOut();
      router.replace('/(auth)/sign-in');
    } catch (error) {
      console.error('Sign out error:', error);
      router.replace('/(auth)/sign-in');
    } finally {
      setIsSigningOut(false);
    }
  };

  const updateNotifications = async (updates: Parameters<typeof updateNotificationPreferences>[0]) => {
    const enabled = await updateNotificationPreferences(updates);
    if (!enabled) {
      Alert.alert('Notifications unavailable', 'Background notifications are available on iOS and Android. On a device, allow notification permission to activate these System alerts.');
    }
  };

  const simulatePenalty = () => {
    resetPenaltyForDemo();
    Alert.alert('Lockdown activated', 'The in-app penalty is active for 24 hours. Your streak was reset and 100 XP was deducted.');
  };

  return (
    <Screen>
      <SectionHeader eyebrow="SYSTEM CONFIG" title="Settings" />

      {/* EMERGENCY WAKE PROTOCOL SECTION */}
      <View style={styles.section}>
        <SectionHeader eyebrow="WAKE PROTOCOL" title="Emergency Alarm" />
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: '#ffb25c' }]}>
          {/* Header Row with Toggle */}
          <View style={styles.row}>
            <View style={[styles.settingIcon, { backgroundColor: 'rgba(255, 178, 92, 0.15)' }]}>
              <Feather name="bell" size={17} color="#ffb25c" />
            </View>
            <View style={styles.copy}>
              <Text style={[styles.settingTitle, { color: colors.foreground }]}>Emergency Wake Protocol</Text>
              <Text style={[styles.settingDetail, { color: colors.mutedForeground }]}>
                Mandatory 30s alarm sound followed by 4 cognitive trials
              </Text>
            </View>
            <Switch
              value={alarmEnabled}
              onValueChange={(val) => void saveAlarmSettings(val, alarmHour, alarmMinute)}
              trackColor={{ false: colors.muted, true: '#ffb25c' }}
              thumbColor={colors.foreground}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Time Selector in Solo Leveling Dark Style */}
          <View style={styles.timePickerContainer}>
            <Text style={styles.timePickerTitle}>SCHEDULED WAKE TIME</Text>
            <View style={styles.timeControlsRow}>
              {/* Hour Box */}
              <View style={styles.timeDigitBox}>
                <TouchableOpacity onPress={() => handleHourChange(1)} style={styles.arrowBtn}>
                  <Feather name="chevron-up" size={18} color="#ffb25c" />
                </TouchableOpacity>
                <Text style={styles.timeDigitText}>
                  {alarmHour.toString().padStart(2, '0')}
                </Text>
                <TouchableOpacity onPress={() => handleHourChange(-1)} style={styles.arrowBtn}>
                  <Feather name="chevron-down" size={18} color="#ffb25c" />
                </TouchableOpacity>
                <Text style={styles.timeUnitLabel}>HR</Text>
              </View>

              <Text style={styles.timeSeparator}>:</Text>

              {/* Minute Box */}
              <View style={styles.timeDigitBox}>
                <TouchableOpacity onPress={() => handleMinuteChange(5)} style={styles.arrowBtn}>
                  <Feather name="chevron-up" size={18} color="#ffb25c" />
                </TouchableOpacity>
                <Text style={styles.timeDigitText}>
                  {alarmMinute.toString().padStart(2, '0')}
                </Text>
                <TouchableOpacity onPress={() => handleMinuteChange(-5)} style={styles.arrowBtn}>
                  <Feather name="chevron-down" size={18} color="#ffb25c" />
                </TouchableOpacity>
                <Text style={styles.timeUnitLabel}>MIN</Text>
              </View>
            </View>

            {/* Next Alarm Label */}
            <Text style={styles.nextAlarmLabel}>{getNextAlarmText()}</Text>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Notification Preview */}
          <View style={styles.notificationPreviewBox}>
            <View style={styles.notifHeaderRow}>
              <Feather name="alert-circle" size={13} color="#ff2a55" />
              <Text style={styles.notifAppTitle}>SYSTEM NOTICE // EMERGENCY</Text>
            </View>
            <Text style={styles.notifTitle}>[System] Emergency Wake Protocol Activated</Text>
            <Text style={styles.notifBody}>Hunter, awaken immediately. Complete all 4 trials to silence the System.</Text>
          </View>

          {/* Test Buttons */}
          <View style={styles.testButtonsRow}>
            <TouchableOpacity
              onPress={handleTestAlarm10s}
              style={[styles.testBtn, testCountdown !== null && styles.testBtnActive]}
              disabled={testCountdown !== null}
            >
              <Feather name="clock" size={14} color="#ffb25c" />
              <Text style={styles.testBtnText}>
                {testCountdown !== null ? `FIRING IN ${testCountdown}s...` : 'TEST ALARM (10s)'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push({ pathname: '/alarm' as any, params: { testMode: 'instant' } })}
              style={styles.instantBtn}
            >
              <Feather name="play" size={14} color="#00e5ff" />
              <Text style={styles.instantBtnText}>LAUNCH NOW</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* NOTIFICATIONS CONFIG */}
      <View style={styles.section}>
        <SectionHeader eyebrow="NOTIFICATIONS" title="Alert Preferences" />
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.row}>
            <View style={[styles.settingIcon, { backgroundColor: colors.accent }]}><Feather name="bell" size={17} color={colors.primary} /></View>
            <View style={styles.copy}><Text style={[styles.settingTitle, { color: colors.foreground }]}>Daily reminders</Text><Text style={[styles.settingDetail, { color: colors.mutedForeground }]}>Morning kickoff at 07:30 · deadline warning at 21:00</Text></View>
            <Switch value={notificationPreferences.dailyReminders} onValueChange={(value) => void updateNotifications({ dailyReminders: value })} trackColor={{ false: colors.muted, true: colors.primary }} thumbColor={colors.foreground} />
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.row}>
            <View style={[styles.settingIcon, { backgroundColor: colors.accent }]}><Feather name="activity" size={17} color={colors.primary} /></View>
            <View style={styles.copy}><Text style={[styles.settingTitle, { color: colors.foreground }]}>Streak at risk</Text><Text style={[styles.settingDetail, { color: colors.mutedForeground }]}>System warning at 22:00 before the daily evaluation closes</Text></View>
            <Switch value={notificationPreferences.streakWarnings} onValueChange={(value) => void updateNotifications({ streakWarnings: value })} trackColor={{ false: colors.muted, true: colors.primary }} thumbColor={colors.foreground} />
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.row}>
            <View style={[styles.settingIcon, { backgroundColor: colors.accent }]}><Feather name="zap" size={17} color={colors.primary} /></View>
            <View style={styles.copy}><Text style={[styles.settingTitle, { color: colors.foreground }]}>Raid gate alerts</Text><Text style={[styles.settingDetail, { color: colors.mutedForeground }]}>Weekly Gate opens notification every Monday at 08:00</Text></View>
            <Switch value={notificationPreferences.raidAlerts} onValueChange={(value) => void updateNotifications({ raidAlerts: value })} trackColor={{ false: colors.muted, true: colors.primary }} thumbColor={colors.foreground} />
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.row}>
            <View style={[styles.settingIcon, { backgroundColor: colors.accent }]}><Feather name="shield" size={17} color={colors.primary} /></View>
            <View style={styles.copy}><Text style={[styles.settingTitle, { color: colors.foreground }]}>Lockdown alerts</Text><Text style={[styles.settingDetail, { color: colors.mutedForeground }]}>Immediate System notice when the failure protocol activates</Text></View>
            <Switch value={notificationPreferences.lockdownAlerts} onValueChange={(value) => void updateNotifications({ lockdownAlerts: value })} trackColor={{ false: colors.muted, true: colors.primary }} thumbColor={colors.foreground} />
          </View>
        </View>
      </View>

      {/* RECOVERY REST DAYS */}
      <View style={styles.section}>
        <SectionHeader eyebrow="RECOVERY PLAN" title="Rest days" />
        <Text style={[styles.helper, { color: colors.mutedForeground }]}>Rest days remove that weekday from both streak requirements and the weekly raid. They do not add a streak day or break an existing streak.</Text>
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

      {/* PENALTY PROTOCOL */}
      <View style={styles.section}>
        <SectionHeader eyebrow="PENALTY PROTOCOL" title="Social lockdown" />
        <View style={[styles.penaltyCard, { borderColor: colors.destructive, backgroundColor: '#291827' }]}>
          <Feather name="shield" color={colors.destructive} size={19} />
          <View style={styles.copy}><Text style={[styles.settingTitle, { color: colors.foreground }]}>Zero-mercy failure protocol</Text><Text style={[styles.settingDetail, { color: colors.mutedForeground }]}>There is no illness or travel grace. A failed required day triggers one 24-hour in-app lockdown, resets your streak, and removes 100 XP. Native social app blocking is planned for a later build.</Text></View>
        </View>
        <Pressable onPress={simulatePenalty} style={[styles.demoButton, { borderColor: colors.destructive }]}>
          <Feather name="alert-triangle" size={16} color={colors.destructive} />
          <Text style={[styles.demoText, { color: colors.destructive }]}>SIMULATE FAILED DAY</Text>
        </Pressable>
      </View>

      {/* SIGN OUT */}
      <View style={styles.section}>
        <Pressable
          onPress={handleSignOut}
          disabled={isSigningOut}
          style={[styles.signOut, { borderColor: colors.border }, isSigningOut && { opacity: 0.5 }]}
        >
          <Feather name="log-out" size={17} color={colors.mutedForeground} />
          <Text style={[styles.signOutText, { color: colors.mutedForeground }]}>
            {isSigningOut ? 'SIGNING OUT...' : 'SIGN OUT'}
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 17, padding: 14 },
  row: { flexDirection: 'row', alignItems: 'center' },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 14 },
  settingIcon: { width: 37, height: 37, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  copy: { flex: 1 },
  settingTitle: { fontSize: 13, fontWeight: '700' },
  settingDetail: { fontSize: 11, lineHeight: 16, marginTop: 4 },
  section: { marginTop: 24 },
  helper: { fontSize: 13, lineHeight: 20, marginTop: -4, marginBottom: 15 },
  dayGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  day: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  dayText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  penaltyCard: { flexDirection: 'row', gap: 11, borderWidth: 1, borderRadius: 17, padding: 14 },
  demoButton: { height: 48, borderWidth: 1, borderRadius: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 11 },
  demoText: { fontSize: 10, fontWeight: '800', letterSpacing: 1.1 },
  signOut: { height: 48, borderWidth: 1, borderRadius: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  signOutText: { fontSize: 11, fontWeight: '800', letterSpacing: 1.1 },

  // Alarm section styles
  timePickerContainer: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  timePickerTitle: {
    fontSize: 9,
    fontWeight: '800',
    color: '#ffb25c',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  timeControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  timeDigitBox: {
    alignItems: 'center',
    backgroundColor: 'rgba(11, 15, 25, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255, 178, 92, 0.3)',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 6,
    minWidth: 72,
  },
  arrowBtn: {
    padding: 4,
  },
  timeDigitText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#ffb25c',
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  timeUnitLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.4)',
    letterSpacing: 1,
    marginTop: 2,
  },
  timeSeparator: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffb25c',
  },
  nextAlarmLabel: {
    fontSize: 11,
    color: '#00e5ff',
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: 12,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  notificationPreviewBox: {
    borderWidth: 1,
    borderColor: 'rgba(255, 42, 85, 0.3)',
    backgroundColor: 'rgba(255, 42, 85, 0.06)',
    borderRadius: 10,
    padding: 12,
    gap: 4,
    marginBottom: 12,
  },
  notifHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  notifAppTitle: {
    fontSize: 9,
    fontWeight: '800',
    color: '#ff2a55',
    letterSpacing: 1.2,
  },
  notifTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff',
    marginTop: 2,
  },
  notifBody: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 14,
  },
  testButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  testBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 178, 92, 0.4)',
    backgroundColor: 'rgba(255, 178, 92, 0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  testBtnActive: {
    borderColor: '#ff2a55',
    backgroundColor: 'rgba(255, 42, 85, 0.15)',
  },
  testBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#ffb25c',
    letterSpacing: 1,
  },
  instantBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.4)',
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  instantBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#00e5ff',
    letterSpacing: 1,
  },
});
