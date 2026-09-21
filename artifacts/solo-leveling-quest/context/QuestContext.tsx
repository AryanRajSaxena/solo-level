import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { SchedulableTriggerInputTypes } from 'expo-notifications';
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import {
  fetchServerState,
  syncDeleteQuest,
  syncNewQuest,
  syncPenalty,
  syncProfile,
  syncQuestCompletion,
  syncRaidClaim,
  syncRestDays,
} from './supabaseSync';
import { useSupabaseAuth } from './SupabaseAuthProvider';

export type QuestCategory = 'TRAINING' | 'MIND' | 'DISCIPLINE' | 'RECOVERY';
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type Quest = {
  id: string;
  title: string;
  detail: string;
  category: QuestCategory;
  target: number;
  unit: string;
  xp: number;
  stat: 'STR' | 'INT' | 'STAMINA' | 'DISCIPLINE';
  weekdays: Weekday[];
  completedOn: string | null;
  progress?: number;
  isCustom?: boolean;
  rampKey?: 'PUSHUPS' | 'SITUPS';
  sensor?: boolean;
};

export type HunterProfile = {
  name: string;
  level: number;
  xp: number;
  xpToNext: number;
  rank: 'E' | 'D' | 'C' | 'B' | 'A' | 'S';
  streak: number;
  longestStreak: number;
  stats: {
    STR: number;
    INT: number;
    STAMINA: number;
    DISCIPLINE: number;
  };
  title: string;
  lockdownUntil: number | null;
  lastCompletedDate: string | null;
  assessmentCompleted?: boolean;
};

export type RaidStatus = 'ACTIVE' | 'PASSED' | 'FAILED' | 'CLAIMED';

export type NotificationPreferences = {
  dailyReminders: boolean;
  streakWarnings: boolean;
  raidAlerts: boolean;
  lockdownAlerts: boolean;
};

export type Raid = {
  id?: string;
  name: string;
  detail: string;
  target: number;
  unit: string;
  xp: number;
  status: RaidStatus;
  weekKey: string;
  requiredQuestIds: string[];
  evaluatedAt: string | null;
};

type QuestContextValue = {
  quests: Quest[];
  completionHistory: Record<string, string[]>;
  profile: HunterProfile;
  raid: Raid;
  restDays: Weekday[];
  loading: boolean;
  todayKey: string;
  todayLabel: string;
  activeQuests: Quest[];
  completedCount: number;
  completionPercent: number;
  raidProgress: number;
  raidPercent: number;
  lastRaid: Raid | null;
  isLockedDown: boolean;
  notificationPreferences: NotificationPreferences;
  onboardingComplete: boolean;
  completeQuest: (id: string) => void;
  setQuestProgress: (id: string, progress: number) => void;
  addQuest: (quest: Omit<Quest, 'id' | 'completedOn' | 'isCustom'>) => void;
  removeQuest: (id: string) => void;
  toggleRestDay: (day: Weekday) => void;
  completeRaid: () => void;
  scheduleReminders: () => Promise<boolean>;
  updateNotificationPreferences: (updates: Partial<NotificationPreferences>) => Promise<boolean>;
  completeOnboarding: (name: string) => void;
  resetPenaltyForDemo: () => void;
  clearPenalty: () => void;
  awardAlarmRewards: (xpAmount?: number, disciplineAmount?: number) => void;
  completeAssessment: (result: {
    rank: 'E' | 'D' | 'C' | 'B' | 'A' | 'S';
    level: number;
    stats: { STR: number; INT: number; STAMINA: number; DISCIPLINE: number };
    title: string;
  }) => void;
};

const STORAGE_KEY = '@solo-leveling-quest/state-v3';
const DAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const XP_BASE = 1000;
const XP_STEP_PER_LEVEL = 100;
const RAMP_TARGETS = [20, 40, 60, 80, 100];
const defaultNotificationPreferences: NotificationPreferences = {
  dailyReminders: false,
  streakWarnings: true,
  raidAlerts: true,
  lockdownAlerts: true,
};

const starterQuests: Quest[] = [
  {
    id: 'pushups',
    title: '100 push-ups',
    detail: 'Build raw strength',
    category: 'TRAINING',
    target: 20,
    unit: 'reps',
    xp: 40,
    stat: 'STR',
    weekdays: [1, 2, 3, 4, 5, 6],
    completedOn: null,
    rampKey: 'PUSHUPS',
  },
  {
    id: 'situps',
    title: '20 sit-ups',
    detail: 'Forge your core',
    category: 'TRAINING',
    target: 20,
    unit: 'reps',
    xp: 40,
    stat: 'STAMINA',
    weekdays: [1, 2, 3, 4, 5, 6],
    completedOn: null,
    rampKey: 'SITUPS',
  },
  {
    id: 'gym',
    title: 'Gym regimen',
    detail: '45 min minimum',
    category: 'TRAINING',
    target: 45,
    unit: 'min',
    xp: 55,
    stat: 'STAMINA',
    weekdays: [1, 3, 5],
    completedOn: null,
  },
  {
    id: 'coding',
    title: 'Deep work coding',
    detail: 'No distractions',
    category: 'MIND',
    target: 60,
    unit: 'min',
    xp: 65,
    stat: 'INT',
    weekdays: [1, 2, 3, 4, 5, 6, 0],
    completedOn: null,
  },
  {
    id: 'gum',
    title: 'Chew gum',
    detail: 'Sharpen the jawline',
    category: 'DISCIPLINE',
    target: 20,
    unit: 'min',
    xp: 15,
    stat: 'DISCIPLINE',
    weekdays: [1, 2, 3, 4, 5, 6, 0],
    completedOn: null,
  },
  {
    id: 'walk_3km',
    title: 'Walk 3 km',
    detail: 'Traverse the gate on foot',
    category: 'TRAINING',
    target: 3,
    unit: 'km',
    xp: 150,
    stat: 'STAMINA',
    weekdays: [1, 2, 3, 4, 5, 6, 0],
    completedOn: null,
    sensor: true,
  },
];

const initialProfile: HunterProfile = {
  name: 'AWAKENED HUNTER',
  level: 1,
  xp: 0,
  xpToNext: 1000,
  rank: 'E',
  streak: 0,
  longestStreak: 0,
  stats: { STR: 1, INT: 1, STAMINA: 1, DISCIPLINE: 1 },
  title: 'E-Rank Hunter',
  lockdownUntil: null,
  lastCompletedDate: null,
};

function dateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function weekKey(date = new Date()) {
  const firstDay = new Date(date);
  firstDay.setDate(date.getDate() - date.getDay());
  return dateKey(firstDay);
}

function formatDateLabel(date = new Date()) {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

function xpToNextForLevel(level: number) {
  return XP_BASE + Math.max(0, level - 1) * XP_STEP_PER_LEVEL;
}

function rankForLevel(level: number): HunterProfile['rank'] {
  if (level >= 50) return 'S';
  if (level >= 35) return 'A';
  if (level >= 25) return 'B';
  if (level >= 15) return 'C';
  if (level >= 8) return 'D';
  return 'E';
}

function dayFromDateKey(key: string) {
  return new Date(`${key}T00:00:00.000Z`);
}

function addDays(key: string, amount: number) {
  const date = dayFromDateKey(key);
  date.setUTCDate(date.getUTCDate() + amount);
  return dateKey(date);
}

function questIdsRequiredOnDate(date: string, quests: Quest[], restDays: Weekday[]) {
  const weekday = dayFromDateKey(date).getUTCDay() as Weekday;
  if (restDays.includes(weekday)) return [];
  return quests.filter((quest) => quest.weekdays.includes(weekday)).map((quest) => quest.id);
}

function isDateComplete(date: string, history: CompletionHistory, quests: Quest[], restDays: Weekday[]) {
  const requiredIds = questIdsRequiredOnDate(date, quests, restDays);
  return requiredIds.length === 0 || requiredIds.every((id) => history[date]?.includes(id));
}

function calculateStreak(
  profile: HunterProfile,
  completedDate: string,
  history: CompletionHistory,
  quests: Quest[],
  restDays: Weekday[],
) {
  if (profile.lastCompletedDate === completedDate) return profile.streak;
  if (!profile.lastCompletedDate) return 1;

  let cursor = addDays(completedDate, -1);
  while (cursor > profile.lastCompletedDate) {
    if (!isDateComplete(cursor, history, quests, restDays)) return 1;
    cursor = addDays(cursor, -1);
  }
  return profile.streak + 1;
}

function rampTargetForDay(startDate: string, currentDate: string) {
  const elapsedDays = Math.max(0, Math.floor((dayFromDateKey(currentDate).getTime() - dayFromDateKey(startDate).getTime()) / 86400000));
  return RAMP_TARGETS[Math.min(RAMP_TARGETS.length - 1, Math.floor(elapsedDays / 3))];
}

function applyRamp(quest: Quest, startDate: string, currentDate: string): Quest {
  if (!quest.rampKey) return quest;
  const target = rampTargetForDay(startDate, currentDate);
  return {
    ...quest,
    target,
    title: `${target} ${quest.rampKey === 'PUSHUPS' ? 'push-ups' : 'sit-ups'}`,
  };
}

function requiredQuestIdsForWeek(quests: Quest[], restDays: Weekday[], startDate: string) {
  return quests
    .filter((quest) => Array.from({ length: 7 }, (_, offset) => addDays(startDate, offset)).some((date) => questIdsRequiredOnDate(date, quests, restDays).includes(quest.id)))
    .map((quest) => quest.id);
}

function createRaid(quests: Quest[], restDays: Weekday[], key = weekKey()): Raid {
  const requiredQuestIds = requiredQuestIdsForWeek(quests, restDays, key);
  return {
    name: 'The Architect’s Trial',
    detail: 'Complete every active quest twice this week',
    target: requiredQuestIds.length * 2,
    unit: 'completions',
    xp: 300,
    status: 'ACTIVE',
    weekKey: key,
    requiredQuestIds,
    evaluatedAt: null,
  };
}

function completionCountForRaid(raid: Raid, history: CompletionHistory) {
  return raid.requiredQuestIds.reduce(
    (total, questId) => total + Math.min(2, Object.values(history).reduce((count, ids) => count + (ids.filter((id) => id === questId).length), 0)),
    0,
  );
}

function evaluateRaid(raid: Raid, history: CompletionHistory): Raid {
  const progress = completionCountForRaid(raid, history);
  return {
    ...raid,
    status: progress >= raid.target ? 'PASSED' : 'FAILED',
    evaluatedAt: dateKey(),
  };
}

type CompletionHistory = Record<string, string[]>;

function addXp(profile: HunterProfile, amount: number, stat: keyof HunterProfile['stats']) {
  let xp = profile.xp + amount;
  let level = profile.level;
  let xpToNext = profile.xpToNext;
  while (xp >= xpToNext) {
    xp -= xpToNext;
    level += 1;
      xpToNext = xpToNextForLevel(level);
  }
  return {
    ...profile,
    xp,
    level,
    xpToNext,
    rank: rankForLevel(level),
    stats: { ...profile.stats, [stat]: profile.stats[stat] + 1 },
  };
}

const QuestContext = createContext<QuestContextValue | null>(null);

export function QuestProvider({ children }: { children: React.ReactNode }) {
  const [quests, setQuests] = useState<Quest[]>(starterQuests);
  const [profile, setProfile] = useState<HunterProfile>(initialProfile);
  const [completionHistory, setCompletionHistory] = useState<CompletionHistory>({});
  const [journeyStartDate, setJourneyStartDate] = useState(dateKey());
  const [raid, setRaid] = useState<Raid>(() => createRaid(starterQuests, [0]));
  const [lastRaid, setLastRaid] = useState<Raid | null>(null);
  const [restDays, setRestDays] = useState<Weekday[]>([0]);
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>(defaultNotificationPreferences);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const { isSignedIn, isLoading: authLoading, user } = useSupabaseAuth();
  const storageKey = `${STORAGE_KEY}:${user?.id ?? 'guest'}`;
  const [hydratedStorageKey, setHydratedStorageKey] = useState<string | null>(null);
  const loading = hydratedStorageKey !== storageKey;
  const todayKey = dateKey();
  const today = new Date();
  const todayIndex = today.getDay() as Weekday;

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      // State must be isolated by Supabase user. Otherwise a newly-created
      // account can inherit the previous user's locally cached progression.
      setQuests(starterQuests);
      setProfile(initialProfile);
      setCompletionHistory({});
      setJourneyStartDate(dateKey());
      setRaid(createRaid(starterQuests, [0]));
      setLastRaid(null);
      setRestDays([0]);
      setNotificationPreferences(defaultNotificationPreferences);
      setOnboardingComplete(false);

      const raw = await AsyncStorage.getItem(storageKey);
      if (cancelled) return;

      if (raw) {
        try {
          const saved = JSON.parse(raw) as {
            quests: Quest[];
            profile: HunterProfile;
            raid: Raid;
            restDays: Weekday[];
            completionHistory?: CompletionHistory;
            journeyStartDate?: string;
            lastRaid?: Raid | null;
            notificationPreferences?: NotificationPreferences;
            onboardingComplete?: boolean;
          };
          const savedRestDays = saved.restDays ?? [0];
          const savedQuests = saved.quests ?? starterQuests;
          const savedHistory = saved.completionHistory ?? Object.fromEntries(
            savedQuests.filter((quest) => quest.completedOn).map((quest) => [quest.completedOn as string, [quest.id]]),
          );
          const savedStartDate = saved.journeyStartDate ?? dateKey();
          const storedRaid = saved.raid?.requiredQuestIds
            ? saved.raid
            : createRaid(savedQuests, savedRestDays, saved.raid?.weekKey || weekKey());
          setQuests(savedQuests);
          setProfile({ ...initialProfile, ...saved.profile, xpToNext: xpToNextForLevel(saved.profile.level) });
          setCompletionHistory(savedHistory);
          setJourneyStartDate(savedStartDate);
          setRestDays(savedRestDays);
          setNotificationPreferences({ ...defaultNotificationPreferences, ...saved.notificationPreferences });
          setOnboardingComplete(saved.onboardingComplete ?? false);
          if (storedRaid.weekKey === weekKey()) {
            setRaid(storedRaid);
            setLastRaid(saved.lastRaid ?? null);
          } else {
            setLastRaid(evaluateRaid(storedRaid, savedHistory));
            setRaid(createRaid(savedQuests, savedRestDays, weekKey()));
          }
        } catch {
          await AsyncStorage.removeItem(storageKey);
        }
      }

      if (!cancelled) setHydratedStorageKey(storageKey);
    })();

    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  useEffect(() => {
    if (loading) return;
    void AsyncStorage.setItem(storageKey, JSON.stringify({ quests, profile, raid, restDays, completionHistory, journeyStartDate, lastRaid, notificationPreferences, onboardingComplete }));
  }, [completionHistory, journeyStartDate, lastRaid, loading, notificationPreferences, onboardingComplete, profile, quests, raid, restDays, storageKey]);

  // ---- Server sync: pull state on launch ----
  const hasSynced = useRef(false);
  useEffect(() => {
    hasSynced.current = false;
  }, [user?.id]);

  useEffect(() => {
    // Wait for local storage to load, auth to be ready, and user to be signed in
    if (loading || authLoading || !isSignedIn || hasSynced.current) return;
    hasSynced.current = true;

    void (async () => {
      try {
        const serverState = await fetchServerState();
        if (!serverState) return; // offline or not authenticated — keep local state

        // Merge strategy: server wins for profile progression if it's ahead
        const serverProfile = serverState.profile;
        setProfile((local) => {
          // Use whichever profile is more progressed (higher level, or same level but more XP)
          const serverAhead =
            serverProfile.level > local.level ||
            (serverProfile.level === local.level && serverProfile.xp > local.xp);
          return serverAhead
            ? {
                ...local,
                ...serverProfile,
                lockdownUntil: serverProfile.lockdownUntil,
              }
            : local;
        });
        if (serverProfile.level > 1 || serverProfile.xp > 0) setOnboardingComplete(true);

        // Merge quests: keep local custom quests, update server-known quests
        if (serverState.quests.length > 0) {
          setQuests((localQuests) => {
            const serverIds = new Set(serverState.quests.map((q) => q.id));
            const localOnlyCustom = localQuests.filter((q) => q.isCustom && !serverIds.has(q.id));
            return [...serverState.quests as Quest[], ...localOnlyCustom];
          });
        }

        // Merge completion history: union of both
        setCompletionHistory((local) => {
          const merged = { ...local };
          for (const [date, ids] of Object.entries(serverState.dailyHistory)) {
            const existing = merged[date] ?? [];
            const combined = [...new Set([...existing, ...ids])];
            merged[date] = combined;
          }
          return merged;
        });

        // Rest days: server wins
        if (serverState.restDays) {
          setRestDays(serverState.restDays as Weekday[]);
        }

        // Raid: carry the server-issued id so syncRaidClaim works
        if (serverState.raid) {
          setRaid((local) => ({
            ...local,
            id: serverState.raid!.id,
            status: serverState.raid!.status as RaidStatus,
            weekKey: serverState.raid!.weekKey,
            requiredQuestIds: serverState.raid!.requiredQuestIds,
            target: serverState.raid!.target,
          }));
        }
        if (serverState.lastRaid) {
          setLastRaid((local) => ({
            ...(local ?? {
              name: serverState.lastRaid!.name,
              detail: serverState.lastRaid!.detail,
              target: serverState.lastRaid!.target,
              unit: serverState.lastRaid!.unit,
              xp: serverState.lastRaid!.xp,
              weekKey: serverState.lastRaid!.weekKey,
              requiredQuestIds: serverState.lastRaid!.requiredQuestIds,
              evaluatedAt: serverState.lastRaid!.evaluatedAt,
            }),
            id: serverState.lastRaid!.id,
            status: serverState.lastRaid!.status as RaidStatus,
          }));
        }
      } catch (error) {
        console.error('[sync] Initial server sync failed:', error);
      }
    })();
  }, [authLoading, isSignedIn, loading]);

  const displayQuests = useMemo(
    () => quests.map((quest) => applyRamp(quest, journeyStartDate, todayKey)),
    [quests, journeyStartDate, todayKey],
  );

  const activeQuests = useMemo(
    () => (restDays.includes(todayIndex) ? [] : displayQuests.filter((quest) => quest.weekdays.includes(todayIndex))),
    [displayQuests, restDays, todayIndex],
  );
  const completedCount = activeQuests.filter((quest) => quest.completedOn === todayKey).length;
  const completionPercent = activeQuests.length ? Math.round((completedCount / activeQuests.length) * 100) : 100;
  const raidProgress = completionCountForRaid(raid, completionHistory);
  const raidPercent = raid.target ? Math.round((raidProgress / raid.target) * 100) : 100;
  const isLockedDown = Boolean(profile.lockdownUntil && profile.lockdownUntil > Date.now());

  useEffect(() => {
    if (loading) return;
    const timer = setInterval(() => {
      const currentWeek = weekKey();
      if (raid.weekKey !== currentWeek) {
        setLastRaid(evaluateRaid(raid, completionHistory));
        setRaid(createRaid(quests, restDays, currentWeek));
      }
    }, 60000);
    return () => clearInterval(timer);
  }, [completionHistory, loading, quests, raid, restDays]);

  const completeQuest = (id: string) => {
    const quest = displayQuests.find((item) => item.id === id);
    if (!quest || quest.completedOn === todayKey || completionHistory[todayKey]?.includes(id)) return;
    const nextHistory = { ...completionHistory, [todayKey]: [...(completionHistory[todayKey] ?? []), id] };
    setCompletionHistory(nextHistory);

    let updatedProfile: HunterProfile | null = null;
    setQuests((current) => current.map((item) => (item.id === id ? { ...item, completedOn: todayKey, progress: item.target } : item)));
    setProfile((current) => {
      const next = addXp(current, quest.xp, quest.stat);
      const dayStreak = isDateComplete(todayKey, nextHistory, displayQuests, restDays)
        ? calculateStreak(current, todayKey, nextHistory, displayQuests, restDays)
        : current.streak;
      updatedProfile = {
        ...next,
        lastCompletedDate: isDateComplete(todayKey, nextHistory, displayQuests, restDays) ? todayKey : current.lastCompletedDate,
        streak: dayStreak,
        longestStreak: Math.max(next.longestStreak, dayStreak),
      };
      return updatedProfile;
    });

    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Sync to Supabase directly after state update settles
    setTimeout(() => {
      if (!updatedProfile) return;
      const statKey = `stat_${quest.stat.toLowerCase()}`;
      syncQuestCompletion(id, {
        xp: updatedProfile.xp,
        level: updatedProfile.level,
        xpToNext: updatedProfile.xpToNext,
        rank: updatedProfile.rank,
        statKey,
        statValue: updatedProfile.stats[quest.stat],
        streak: updatedProfile.streak,
        longestStreak: updatedProfile.longestStreak,
        lastCompletedDate: updatedProfile.lastCompletedDate,
      });
    }, 0);
  };

  const setQuestProgress = (id: string, progress: number) => {
    const quest = displayQuests.find((item) => item.id === id);
    if (!quest || quest.completedOn === todayKey) return;
    const nextProgress = Math.max(0, Math.min(quest.target, Math.floor(progress)));
    setQuests((current) => current.map((item) => (item.id === id ? { ...item, progress: nextProgress } : item)));
    if (nextProgress >= quest.target) completeQuest(id);
  };

  const addQuest = (quest: Omit<Quest, 'id' | 'completedOn' | 'isCustom'>) => {
    const localId = `${Date.now()}`;
    setQuests((current) => [
      ...current,
      { ...quest, id: localId, completedOn: null, isCustom: true },
    ]);
    syncNewQuest({ ...quest, id: localId });
  };

  const removeQuest = (id: string) => {
    setQuests((current) => current.filter((quest) => quest.id !== id));
    syncDeleteQuest(id);
  };

  const toggleRestDay = (day: Weekday) => {
    setRestDays((current) => {
      const next = current.includes(day) ? current.filter((item) => item !== day) : [...current, day];
      syncRestDays(next);
      return next;
    });
  };

  const completeRaid = () => {
    if (!lastRaid || lastRaid.status !== 'PASSED') return;
    const raidId = lastRaid.id ?? '';
    setLastRaid((current) => current ? { ...current, status: 'CLAIMED' } : current);
    setProfile((current) => {
      const next = addXp(
        { ...current, title: 'Breaker of the Architect', stats: { ...current.stats, DISCIPLINE: current.stats.DISCIPLINE + 3 } },
        lastRaid.xp,
        'DISCIPLINE'
      );
      if (raidId) {
        syncRaidClaim(raidId, {
          xp: next.xp,
          level: next.level,
          xpToNext: next.xpToNext,
          rank: next.rank,
          title: next.title,
          statDiscipline: next.stats.DISCIPLINE,
        });
      }
      return next;
    });
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const scheduleNotifications = async (preferences: NotificationPreferences) => {
    // expo-notifications cannot schedule background notifications on web.
    if (Platform.OS === 'web') return false;

    if (Object.values(preferences).every((enabled) => !enabled)) {
      await Notifications.cancelAllScheduledNotificationsAsync();
      return true;
    }

    const currentPermission = await Notifications.getPermissionsAsync();
    const permission = currentPermission.granted
      ? currentPermission
      : await Notifications.requestPermissionsAsync();
    if (!permission.granted) return false;

    await Notifications.cancelAllScheduledNotificationsAsync();

    if (preferences.dailyReminders) {
      await Notifications.scheduleNotificationAsync({
        content: { title: 'SYSTEM // Daily gate opened', body: 'The dungeon is open. Begin your training.' },
        trigger: { type: SchedulableTriggerInputTypes.CALENDAR, hour: 7, minute: 30, repeats: true },
      });
      await Notifications.scheduleNotificationAsync({
        content: { title: 'SYSTEM // Deadline warning', body: 'Your daily evaluation ends at midnight.' },
        trigger: { type: SchedulableTriggerInputTypes.CALENDAR, hour: 21, minute: 0, repeats: true },
      });
    }

    if (preferences.streakWarnings) {
      await Notifications.scheduleNotificationAsync({
        content: { title: 'SYSTEM // Streak at risk', body: 'Complete your remaining quests before midnight to protect your streak.' },
        trigger: { type: SchedulableTriggerInputTypes.CALENDAR, hour: 22, minute: 0, repeats: true },
      });
    }

    if (preferences.raidAlerts) {
      await Notifications.scheduleNotificationAsync({
        content: { title: 'SYSTEM // Gate opens', body: 'The Architect\'s Trial is now active. Prepare for this week\'s raid.' },
        // Expo weekdays are 1-indexed: Sunday is 1, Monday is 2.
        trigger: { type: SchedulableTriggerInputTypes.CALENDAR, weekday: 2, hour: 8, minute: 0, repeats: true },
      });
    }

    return true;
  };

  const scheduleReminders = () => scheduleNotifications({
    ...notificationPreferences,
    dailyReminders: true,
  });

  const updateNotificationPreferences = async (updates: Partial<NotificationPreferences>) => {
    const next = { ...notificationPreferences, ...updates };
    const scheduled = await scheduleNotifications(next);
    if (scheduled) setNotificationPreferences(next);
    return scheduled;
  };

  const completeOnboarding = (name: string) => {
    const hunterName = name.trim().slice(0, 30);
    if (hunterName) {
      const upper = hunterName.toUpperCase();
      setProfile((current) => ({ ...current, name: upper }));
      syncProfile({ name: upper });
    }
    setOnboardingComplete(true);
  };

  const resetPenaltyForDemo = () => {
    const lockdownUntil = Date.now() + 24 * 60 * 60 * 1000;
    setProfile((current) => {
      const newXp = Math.max(0, current.xp - 100);
      syncPenalty({ lockdownUntil, xp: newXp });
      return { ...current, lockdownUntil, streak: 0, lastCompletedDate: null, xp: newXp };
    });
    if (notificationPreferences.lockdownAlerts && Platform.OS !== 'web') {
      void Notifications.scheduleNotificationAsync({
        content: { title: 'SYSTEM // LOCKDOWN ACTIVATED', body: 'Your streak was reset. Social lockdown remains active for 24 hours.' },
        trigger: null,
      });
    }
  };

  const clearPenalty = () => {
    setProfile((current) => {
      syncPenalty({ lockdownUntil: null, xp: current.xp });
      return { ...current, lockdownUntil: null };
    });
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const awardAlarmRewards = (xpAmount = 50, disciplineAmount = 1) => {
    let updatedProfile: HunterProfile | null = null;
    setProfile((current) => {
      const next = addXp(current, xpAmount, 'DISCIPLINE');
      updatedProfile = {
        ...next,
        stats: {
          ...next.stats,
          DISCIPLINE: next.stats.DISCIPLINE + (disciplineAmount > 0 ? disciplineAmount - 1 : 0),
        },
      };
      return updatedProfile;
    });

    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    setTimeout(() => {
      if (!updatedProfile) return;
      syncProfile({
        xp: updatedProfile.xp,
        level: updatedProfile.level,
        xpToNext: updatedProfile.xpToNext,
        rank: updatedProfile.rank,
        stat_discipline: updatedProfile.stats.DISCIPLINE,
      });
    }, 0);
  };

  const completeAssessment = (result: {
    rank: 'E' | 'D' | 'C' | 'B' | 'A' | 'S';
    level: number;
    stats: { STR: number; INT: number; STAMINA: number; DISCIPLINE: number };
    title: string;
  }) => {
    let updatedProfile: HunterProfile | null = null;
    setProfile((current) => {
      updatedProfile = {
        ...current,
        rank: result.rank,
        level: Math.max(current.level, result.level),
        stats: {
          STR: Math.max(current.stats.STR, result.stats.STR),
          INT: Math.max(current.stats.INT, result.stats.INT),
          STAMINA: Math.max(current.stats.STAMINA, result.stats.STAMINA),
          DISCIPLINE: Math.max(current.stats.DISCIPLINE, result.stats.DISCIPLINE),
        },
        title: result.title,
        assessmentCompleted: true,
        xpToNext: xpToNextForLevel(Math.max(current.level, result.level)),
      };
      return updatedProfile;
    });

    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    setTimeout(() => {
      if (!updatedProfile) return;
      syncProfile({
        rank: updatedProfile.rank,
        level: updatedProfile.level,
        title: updatedProfile.title,
        stat_discipline: updatedProfile.stats.DISCIPLINE,
      });
    }, 0);
  };

  return (
    <QuestContext.Provider
      value={{
        quests,
        completionHistory,
        profile,
        raid,
        restDays,
        loading,
        todayKey,
        todayLabel: formatDateLabel(today),
        activeQuests,
        completedCount,
        completionPercent,
        raidProgress,
        raidPercent,
        lastRaid,
        isLockedDown,
        notificationPreferences,
        onboardingComplete,
        completeQuest,
        setQuestProgress,
        addQuest,
        removeQuest,
        toggleRestDay,
        completeRaid,
        scheduleReminders,
        updateNotificationPreferences,
        completeOnboarding,
        resetPenaltyForDemo,
        clearPenalty,
        awardAlarmRewards,
        completeAssessment,
      }}
    >
      {children}
    </QuestContext.Provider>
  );
}

export function useQuestContext() {
  const value = useContext(QuestContext);
  if (!value) throw new Error('useQuestContext must be used inside QuestProvider');
  return value;
}

export { DAY_LABELS, dateKey };
