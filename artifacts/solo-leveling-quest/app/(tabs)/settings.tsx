import { Feather } from '@expo/vector-icons';
import { useSupabaseAuth } from '@/context/SupabaseAuthProvider';
import { useRouter } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, View, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Screen, SectionHeader } from '@/components/Screen';
import { DAY_LABELS, Weekday, useQuestContext } from '@/context/QuestContext';
import { useColors } from '@/hooks/useColors';
import {
  ARCHITECT_TRIAL_TRACK,
  alarmAudio,
} from '@/utils/alarmAudio';
import { SocialLockdownModal } from '@/components/penalty/SocialLockdownModal';
import { RESTRICTED_APPS, getRemainingLockdownTime } from '@/utils/socialAppLockdown';

const ALARM_SETTINGS_KEY = '@solo-leveling-quest/alarm-settings-v1';

const PRESET_TIMES = [
  { label: '06:00', h: 6, m: 0 },
  { label: '06:30', h: 6, m: 30 },
  { label: '07:00', h: 7, m: 0 },
  { label: '07:30', h: 7, m: 30 },
];

export default function SettingsScreen() {
  const colors = useColors();
  const router = useRouter();
  const { signOut } = useSupabaseAuth();
  const {
    profile,
    isLockedDown,
    clearPenalty,
    restDays,
    toggleRestDay,
    notificationPreferences,
    updateNotificationPreferences,
    resetPenaltyForDemo,
  } = useQuestContext();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [showLockdownModal, setShowLockdownModal] = useState(false);
  const [countdown, setCountdown] = useState(() => getRemainingLockdownTime(profile.lockdownUntil));

  useEffect(() => {
    setCountdown(getRemainingLockdownTime(profile.lockdownUntil));
    const interval = setInterval(() => {
      setCountdown(getRemainingLockdownTime(profile.lockdownUntil));
    }, 1000);
    return () => clearInterval(interval);
  }, [profile.lockdownUntil]);

  // Alarm settings state
  const [alarmEnabled, setAlarmEnabled] = useState(true);
  const [alarmHour, setAlarmHour] = useState(6);
  const [alarmMinute, setAlarmMinute] = useState(30);
  const [isPreviewing, setIsPreviewing] = useState(false);

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

    return () => {
      alarmAudio.stopPreview();
    };
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

  const handleTogglePreview = () => {
    if (isPreviewing) {
      alarmAudio.stopPreview();
      setIsPreviewing(false);
    } else {
      setIsPreviewing(true);
      alarmAudio.previewAlarm(() => setIsPreviewing(false));
    }
  };

  const formatTime = (h: number, m: number) => {
    const hStr = h.toString().padStart(2, '0');
    const mStr = m.toString().padStart(2, '0');
    return `${hStr}:${mStr}`;
  };

  const getNextAlarmText = () => {
    if (!alarmEnabled) return 'Protocol Standby (Disabled)';
    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();
    const alarmMins = alarmHour * 60 + alarmMinute;
    const isToday = alarmMins > currentMins;
    return `${isToday ? 'Today' : 'Tomorrow'} at ${formatTime(alarmHour, alarmMinute)}`;
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
      Alert.alert('Notifications unavailable', 'Background notifications are available on iOS and Android.');
    }
  };

  const simulatePenalty = () => {
    resetPenaltyForDemo();
    Alert.alert(
      'System Lockdown Activated',
      'Penalty directive initiated for 24 hours. Social and commercial portals (Instagram, LinkedIn, Facebook, Flipkart, Amazon, Myntra) are now sealed.',
      [
        { text: 'DISMISS', style: 'cancel' },
        { text: 'VIEW PORTALS HUD', onPress: () => setShowLockdownModal(true) },
      ],
    );
  };

  const handleDispelPenalty = () => {
    Alert.alert(
      'Dispel Penalty Override',
      'Are you sure you want to dispel the System Penalty early? This will unseal all social and commercial portals.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'DISPEL PENALTY',
          style: 'destructive',
          onPress: () => {
            clearPenalty();
            Alert.alert('Lockdown Dispelled', 'System penalty cleared. All portals have been unsealed.');
          },
        },
      ],
    );
  };

  return (
    <Screen>
      <SectionHeader eyebrow="SYSTEM CONFIG // DIRECTIVES" title="System Settings" />

      {/* ─── SECTION 1: EMERGENCY WAKE PROTOCOL ─── */}
      <View style={styles.section}>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: alarmEnabled ? '#ffb25c' : colors.border }]}>
          {/* Header Row with Clean Status & Switch */}
          <View style={styles.cardHeaderRow}>
            <View style={[styles.settingIcon, { backgroundColor: alarmEnabled ? 'rgba(255, 178, 92, 0.15)' : 'rgba(255, 255, 255, 0.05)' }]}>
              <Feather name="bell" size={17} color={alarmEnabled ? '#ffb25c' : colors.mutedForeground} />
            </View>
            <View style={styles.copy}>
              <View style={styles.titleWithBadge}>
                <Text style={[styles.settingTitle, { color: colors.foreground }]}>Emergency Wake Protocol</Text>
                <View style={[styles.statusBadge, { borderColor: alarmEnabled ? '#ffb25c' : colors.border, backgroundColor: alarmEnabled ? 'rgba(255, 178, 92, 0.12)' : 'transparent' }]}>
                  <Text style={[styles.statusBadgeText, { color: alarmEnabled ? '#ffb25c' : colors.mutedForeground }]}>
                    {alarmEnabled ? 'ACTIVE' : 'STANDBY'}
                  </Text>
                </View>
              </View>
              <Text style={[styles.settingDetail, { color: colors.mutedForeground }]}>
                {getNextAlarmText()}
              </Text>
            </View>
            <Switch
              value={alarmEnabled}
              onValueChange={(val) => void saveAlarmSettings(val, alarmHour, alarmMinute)}
              trackColor={{ false: colors.muted, true: '#ffb25c' }}
              thumbColor={colors.foreground}
            />
          </View>

          {alarmEnabled ? (
            <>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              {/* Compact Sleek Time Stepper */}
              <View style={styles.timePickerRow}>
                <View style={styles.timeMainDisplay}>
                  <Text style={styles.timeDigits}>{formatTime(alarmHour, alarmMinute)}</Text>
                  <Text style={styles.timeAmPm}>{alarmHour >= 12 ? 'PM' : 'AM'}</Text>
                </View>

                <View style={styles.stepperContainer}>
                  {/* Hours */}
                  <View style={styles.stepperUnit}>
                    <Text style={styles.stepperUnitTitle}>HOUR</Text>
                    <View style={styles.stepperButtons}>
                      <Pressable onPress={() => handleHourChange(-1)} style={styles.stepBtn}>
                        <Feather name="minus" size={13} color="#ffb25c" />
                      </Pressable>
                      <Pressable onPress={() => handleHourChange(1)} style={styles.stepBtn}>
                        <Feather name="plus" size={13} color="#ffb25c" />
                      </Pressable>
                    </View>
                  </View>

                  {/* Minutes */}
                  <View style={styles.stepperUnit}>
                    <Text style={styles.stepperUnitTitle}>MIN</Text>
                    <View style={styles.stepperButtons}>
                      <Pressable onPress={() => handleMinuteChange(-5)} style={styles.stepBtn}>
                        <Feather name="minus" size={13} color="#ffb25c" />
                      </Pressable>
                      <Pressable onPress={() => handleMinuteChange(5)} style={styles.stepBtn}>
                        <Feather name="plus" size={13} color="#ffb25c" />
                      </Pressable>
                    </View>
                  </View>
                </View>
              </View>

              {/* Quick Presets */}
              <View style={styles.presetsRow}>
                {PRESET_TIMES.map((preset) => {
                  const isPresetActive = alarmHour === preset.h && alarmMinute === preset.m;
                  return (
                    <Pressable
                      key={preset.label}
                      onPress={() => void saveAlarmSettings(alarmEnabled, preset.h, preset.m)}
                      style={[styles.presetChip, isPresetActive && styles.presetChipActive]}
                    >
                      <Text style={[styles.presetChipText, isPresetActive && styles.presetChipTextActive]}>
                        {preset.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              {/* Solo Leveling Dedicated Soundtrack */}
              <View style={styles.toneSection}>
                <View style={styles.toneSectionHeader}>
                  <Feather name="disc" size={12} color="#00e5ff" />
                  <Text style={styles.toneSectionTitle}>ALARM SOUNDTRACK</Text>
                </View>

                <View style={styles.toneCard}>
                  <View style={styles.toneIcon}>
                    <Feather name="volume-2" size={16} color="#00e5ff" />
                  </View>

                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.toneName}>{ARCHITECT_TRIAL_TRACK.name}</Text>
                      <View style={styles.toneBadge}>
                        <Text style={styles.toneBadgeText}>{ARCHITECT_TRIAL_TRACK.badge}</Text>
                      </View>
                    </View>
                    <Text style={styles.toneSubtitle}>{ARCHITECT_TRIAL_TRACK.subtitle}</Text>
                  </View>

                  <Pressable
                    onPress={handleTogglePreview}
                    hitSlop={8}
                    style={[styles.previewBtn, isPreviewing && styles.previewBtnActive]}
                  >
                    <Feather
                      name={isPreviewing ? 'square' : 'play'}
                      size={12}
                      color={isPreviewing ? '#ff2a55' : '#00e5ff'}
                    />
                    <Text style={[styles.previewBtnText, isPreviewing && { color: '#ff2a55' }]}>
                      {isPreviewing ? 'STOP' : 'PREVIEW'}
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Single Launch Action */}
              <Pressable
                onPress={() => router.push({ pathname: '/alarm' as any, params: { testMode: 'instant' } })}
                style={styles.launchBtn}
              >
                <Feather name="play-circle" size={15} color="#050811" />
                <Text style={styles.launchBtnText}>LAUNCH PROTOCOL SIMULATION</Text>
              </Pressable>
            </>
          ) : null}
        </View>
      </View>

      {/* ─── SECTION 2: SYSTEM BROADCASTS ─── */}
      <View style={styles.section}>
        <SectionHeader eyebrow="NOTIFICATIONS" title="Alert Directives" />
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.row}>
            <View style={[styles.settingIcon, { backgroundColor: colors.accent }]}>
              <Feather name="clock" size={16} color={colors.primary} />
            </View>
            <View style={styles.copy}>
              <Text style={[styles.settingTitle, { color: colors.foreground }]}>Daily Kickoff & Deadline</Text>
              <Text style={[styles.settingDetail, { color: colors.mutedForeground }]}>Kickoff at 07:30 · Deadline warning at 21:00</Text>
            </View>
            <Switch
              value={notificationPreferences.dailyReminders}
              onValueChange={(value) => void updateNotifications({ dailyReminders: value })}
              trackColor={{ false: colors.muted, true: colors.primary }}
              thumbColor={colors.foreground}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.row}>
            <View style={[styles.settingIcon, { backgroundColor: colors.accent }]}>
              <Feather name="zap" size={16} color="#ffb25c" />
            </View>
            <View style={styles.copy}>
              <Text style={[styles.settingTitle, { color: colors.foreground }]}>Streak Defense Alert</Text>
              <Text style={[styles.settingDetail, { color: colors.mutedForeground }]}>Warning at 22:00 before daily evaluation</Text>
            </View>
            <Switch
              value={notificationPreferences.streakWarnings}
              onValueChange={(value) => void updateNotifications({ streakWarnings: value })}
              trackColor={{ false: colors.muted, true: colors.primary }}
              thumbColor={colors.foreground}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.row}>
            <View style={[styles.settingIcon, { backgroundColor: colors.accent }]}>
              <Feather name="shield" size={16} color={colors.primary} />
            </View>
            <View style={styles.copy}>
              <Text style={[styles.settingTitle, { color: colors.foreground }]}>Raid & Gate Notices</Text>
              <Text style={[styles.settingDetail, { color: colors.mutedForeground }]}>Gate alerts and weekly trial bulletins</Text>
            </View>
            <Switch
              value={notificationPreferences.raidAlerts}
              onValueChange={(value) => void updateNotifications({ raidAlerts: value })}
              trackColor={{ false: colors.muted, true: colors.primary }}
              thumbColor={colors.foreground}
            />
          </View>
        </View>
      </View>

      {/* ─── SECTION 3: RECOVERY REST DAYS ─── */}
      <View style={styles.section}>
        <SectionHeader eyebrow="RECOVERY PLAN" title="Rest Days" />
        <Text style={[styles.helperText, { color: colors.mutedForeground }]}>
          Exempt chosen days from streak penalties and raid requirements.
        </Text>
        <View style={styles.dayGrid}>
          {DAY_LABELS.map((label, index) => {
            const selected = restDays.includes(index as Weekday);
            return (
              <Pressable
                key={label}
                onPress={() => toggleRestDay(index as Weekday)}
                style={[
                  styles.dayChip,
                  {
                    backgroundColor: selected ? 'rgba(0, 229, 255, 0.15)' : colors.card,
                    borderColor: selected ? '#00e5ff' : colors.border,
                  },
                ]}
              >
                <Text style={[styles.dayChipText, { color: selected ? '#00e5ff' : colors.mutedForeground }]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* ─── SECTION 4: ZERO-TOLERANCE PROTOCOL // SOCIAL LOCKDOWN ─── */}
      <View style={styles.section}>
        <View style={[styles.penaltyCard, isLockedDown && styles.penaltyCardActive]}>
          <View style={styles.penaltyHeader}>
            <Feather name="alert-triangle" size={15} color="#ff2a55" />
            <Text style={styles.penaltyTitle}>PENALTY DIRECTIVE // APP LOCKDOWN</Text>
            <View style={[styles.penaltyBadge, isLockedDown && { backgroundColor: '#ff2a55' }]}>
              <Text style={[styles.penaltyBadgeText, isLockedDown && { color: '#ffffff' }]}>
                {isLockedDown ? 'ACTIVE' : 'ENFORCED'}
              </Text>
            </View>
          </View>

          {isLockedDown ? (
            <View style={styles.activeLockdownBlock}>
              <Text style={styles.activeLockdownTimer}>{countdown.formatted}</Text>
              <Text style={styles.activeLockdownSub}>
                PENALTY SURVIVAL TIME REMAINING · Distraction portals sealed
              </Text>
            </View>
          ) : (
            <Text style={styles.penaltyBody}>
              Uncompleted active days trigger a 24-hr social lockdown across Instagram, LinkedIn, Facebook, Flipkart, Amazon, Myntra, and entertainment portals.
            </Text>
          )}

          {/* Mini preview row of restricted apps */}
          <View style={styles.appPillsRow}>
            {RESTRICTED_APPS.slice(0, 6).map((app) => (
              <View key={app.id} style={[styles.appMiniPill, isLockedDown && styles.appMiniPillLocked]}>
                <Feather name={app.featherIcon as unknown as any} size={11} color={isLockedDown ? '#ff2a55' : colors.mutedForeground} />
                <Text style={[styles.appMiniPillText, { color: isLockedDown ? '#ff8599' : colors.mutedForeground }]}>
                  {app.name}
                </Text>
              </View>
            ))}
          </View>

          {/* Action buttons */}
          <View style={styles.penaltyActionRow}>
            <Pressable onPress={() => setShowLockdownModal(true)} style={styles.penaltyViewBtn}>
              <Feather name="shield" size={13} color="#00e5ff" />
              <Text style={styles.penaltyViewBtnText}>VIEW SEALED PORTALS</Text>
            </Pressable>

            {isLockedDown ? (
              <Pressable onPress={handleDispelPenalty} style={styles.penaltyDispelBtn}>
                <Feather name="unlock" size={13} color="#ff8599" />
                <Text style={styles.penaltyDispelBtnText}>DISPEL PENALTY</Text>
              </Pressable>
            ) : (
              <Pressable onPress={simulatePenalty} style={styles.penaltySimBtn}>
                <Text style={styles.penaltySimBtnText}>SIMULATE LOCKDOWN</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>

      {/* ─── SECTION 5: ACCOUNT / SIGN OUT ─── */}
      <View style={[styles.section, { marginBottom: 30 }]}>
        <Pressable
          onPress={handleSignOut}
          disabled={isSigningOut}
          style={[styles.signOutBtn, { borderColor: colors.border }, isSigningOut && { opacity: 0.5 }]}
        >
          <Feather name="log-out" size={15} color={colors.mutedForeground} />
          <Text style={[styles.signOutBtnText, { color: colors.mutedForeground }]}>
            {isSigningOut ? 'SIGNING OUT...' : 'SIGN OUT OF SYSTEM'}
          </Text>
        </Pressable>
      </View>

      <SocialLockdownModal
        visible={showLockdownModal}
        onClose={() => setShowLockdownModal(false)}
        lockdownUntil={profile.lockdownUntil}
        onClearPenalty={clearPenalty}
        onStartAtonement={() => router.push('/pose-tracker' as any)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 20,
  },
  card: {
    borderWidth: 1.5,
    borderRadius: 18,
    padding: 16,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
  },
  titleWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  settingTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  settingDetail: {
    fontSize: 11,
    marginTop: 2,
  },
  statusBadge: {
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 5,
  },
  statusBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  divider: {
    height: 1,
    marginVertical: 14,
  },
  timePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  timeMainDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  timeDigits: {
    fontSize: 32,
    fontWeight: '900',
    color: '#ffb25c',
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  timeAmPm: {
    fontSize: 12,
    fontWeight: '800',
    color: 'rgba(255, 178, 92, 0.6)',
  },
  stepperContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  stepperUnit: {
    alignItems: 'center',
    gap: 4,
  },
  stepperUnitTitle: {
    fontSize: 8,
    fontWeight: '900',
    color: 'rgba(255, 255, 255, 0.4)',
    letterSpacing: 1,
  },
  stepperButtons: {
    flexDirection: 'row',
    gap: 4,
  },
  stepBtn: {
    width: 28,
    height: 28,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(255, 178, 92, 0.3)',
    backgroundColor: 'rgba(255, 178, 92, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  presetChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 8,
    paddingVertical: 6,
    alignItems: 'center',
  },
  presetChipActive: {
    borderColor: '#ffb25c',
    backgroundColor: 'rgba(255, 178, 92, 0.15)',
  },
  presetChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.6)',
  },
  presetChipTextActive: {
    color: '#ffb25c',
    fontWeight: '900',
  },
  toneSection: {
    gap: 8,
  },
  toneSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  toneSectionTitle: {
    fontSize: 9,
    fontWeight: '900',
    color: '#00e5ff',
    letterSpacing: 1.2,
  },
  toneCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
    backgroundColor: 'rgba(0, 229, 255, 0.05)',
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  toneIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toneName: {
    fontSize: 12,
    fontWeight: '800',
    color: '#00e5ff',
  },
  toneBadge: {
    borderWidth: 1,
    borderColor: '#00e5ff',
    paddingHorizontal: 5,
    paddingVertical: 0.5,
    borderRadius: 4,
  },
  toneBadgeText: {
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.6,
    color: '#00e5ff',
  },
  toneSubtitle: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  previewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.4)',
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  previewBtnActive: {
    borderColor: '#ff2a55',
    backgroundColor: 'rgba(255, 42, 85, 0.15)',
  },
  previewBtnText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#00e5ff',
    letterSpacing: 0.8,
  },
  launchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#00e5ff',
    borderRadius: 12,
    height: 44,
    marginTop: 14,
    shadowColor: '#00e5ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  launchBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#050811',
    letterSpacing: 1.2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  helperText: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: -4,
    marginBottom: 12,
  },
  dayGrid: {
    flexDirection: 'row',
    gap: 6,
  },
  dayChip: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayChipText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  penaltyCard: {
    borderWidth: 1.5,
    borderColor: 'rgba(255, 42, 85, 0.35)',
    backgroundColor: 'rgba(255, 42, 85, 0.05)',
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  penaltyCardActive: {
    borderColor: '#ff2a55',
    backgroundColor: 'rgba(255, 42, 85, 0.12)',
  },
  penaltyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  penaltyTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#ff2a55',
    letterSpacing: 1.2,
    flex: 1,
  },
  penaltyBadge: {
    borderWidth: 1,
    borderColor: '#ff2a55',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 42, 85, 0.15)',
  },
  penaltyBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#ff2a55',
    letterSpacing: 1,
  },
  activeLockdownBlock: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  activeLockdownTimer: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '900',
    fontFamily: 'monospace',
    letterSpacing: 2,
    textShadowColor: '#ff2a55',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  activeLockdownSub: {
    color: '#ff8599',
    fontSize: 10,
    fontFamily: 'monospace',
    fontWeight: '700',
    marginTop: 2,
    textAlign: 'center',
  },
  penaltyBody: {
    fontSize: 11,
    lineHeight: 16,
    color: 'rgba(255, 255, 255, 0.65)',
  },
  appPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: 2,
  },
  appMiniPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  appMiniPillLocked: {
    backgroundColor: 'rgba(255, 42, 85, 0.15)',
    borderColor: 'rgba(255, 42, 85, 0.5)',
  },
  appMiniPillText: {
    fontSize: 9,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  penaltyActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  penaltyViewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    borderWidth: 1,
    borderColor: '#00e5ff',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  penaltyViewBtnText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#00e5ff',
    fontFamily: 'monospace',
    letterSpacing: 0.8,
  },
  penaltyDispelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#ff2a55',
    backgroundColor: 'rgba(255, 42, 85, 0.2)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  penaltyDispelBtnText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#ff8599',
    fontFamily: 'monospace',
    letterSpacing: 0.8,
  },
  penaltySimBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255, 42, 85, 0.5)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  penaltySimBtnText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#ff2a55',
    letterSpacing: 0.8,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    height: 46,
  },
  signOutBtnText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
});
