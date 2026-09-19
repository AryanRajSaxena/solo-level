import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { SchedulableTriggerInputTypes } from 'expo-notifications';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

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
  isCustom?: boolean;
  rampKey?: 'PUSHUPS' | 'SITUPS';
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
};

export type RaidStatus = 'ACTIVE' | 'PASSED' | 'FAILED' | 'CLAIMED';

export type Raid = {
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
  completeQuest: (id: string) => void;
  addQuest: (quest: Omit<Quest, 'id' | 'completedOn' | 'isCustom'>) => void;
  removeQuest: (id: string) => void;
  toggleRestDay: (day: Weekday) => void;
  completeRaid: () => void;
  scheduleReminders: () => Promise<boolean>;
  resetPenaltyForDemo: () => void;
};

const STORAGE_KEY = '@solo-leveling-quest/state-v1';
const DAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const XP_BASE = 1000;
const XP_STEP_PER_LEVEL = 100;
const RAMP_TARGETS = [20, 40, 60, 80, 100];

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
];

const initialProfile: HunterProfile = {
  name: 'AWAKENED HUNTER',
  level: 12,
  xp: 1240,
  xpToNext: 2100,
  rank: 'C',
  streak: 6,
  longestStreak: 12,
  stats: { STR: 28, INT: 24, STAMINA: 31, DISCIPLINE: 26 },
  title: 'The Relentless',
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
  const [loading, setLoading] = useState(true);
  const todayKey = dateKey();
  const today = new Date();
  const todayIndex = today.getDay() as Weekday;

  useEffect(() => {
    void (async () => {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
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
          if (storedRaid.weekKey === weekKey()) {
            setRaid(storedRaid);
            setLastRaid(saved.lastRaid ?? null);
          } else {
            setLastRaid(evaluateRaid(storedRaid, savedHistory));
            setRaid(createRaid(savedQuests, savedRestDays, weekKey()));
          }
        } catch {
          await AsyncStorage.removeItem(STORAGE_KEY);
        }
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (loading) return;
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ quests, profile, raid, restDays, completionHistory, journeyStartDate, lastRaid }));
  }, [loading, profile, quests, raid, restDays, completionHistory, journeyStartDate, lastRaid]);

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
    setQuests((current) => current.map((item) => (item.id === id ? { ...item, completedOn: todayKey } : item)));
    setProfile((current) => {
      const next = addXp(current, quest.xp, quest.stat);
      const dayStreak = isDateComplete(todayKey, nextHistory, displayQuests, restDays)
        ? calculateStreak(current, todayKey, nextHistory, displayQuests, restDays)
        : current.streak;
      return {
        ...next,
        lastCompletedDate: isDateComplete(todayKey, nextHistory, displayQuests, restDays) ? todayKey : current.lastCompletedDate,
        streak: dayStreak,
        longestStreak: Math.max(next.longestStreak, dayStreak),
      };
    });
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const addQuest = (quest: Omit<Quest, 'id' | 'completedOn' | 'isCustom'>) => {
    setQuests((current) => [
      ...current,
      { ...quest, id: `${Date.now()}`, completedOn: null, isCustom: true },
    ]);
  };

  const removeQuest = (id: string) => {
    setQuests((current) => current.filter((quest) => quest.id !== id));
  };

  const toggleRestDay = (day: Weekday) => {
    setRestDays((current) => (current.includes(day) ? current.filter((item) => item !== day) : [...current, day]));
  };

  const completeRaid = () => {
    if (!lastRaid || lastRaid.status !== 'PASSED') return;
    setLastRaid((current) => current ? { ...current, status: 'CLAIMED' } : current);
    setProfile((current) => addXp({ ...current, title: 'Breaker of the Architect', stats: { ...current.stats, DISCIPLINE: current.stats.DISCIPLINE + 3 } }, lastRaid.xp, 'DISCIPLINE'));
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const scheduleReminders = async () => {
    const permission = await Notifications.requestPermissionsAsync();
    if (!permission.granted) return false;
    await Notifications.cancelAllScheduledNotificationsAsync();
    await Notifications.scheduleNotificationAsync({
      content: { title: 'SYSTEM // Daily quests await', body: 'The dungeon is open. Start your training.' },
      trigger: { type: SchedulableTriggerInputTypes.CALENDAR, hour: 7, minute: 30, repeats: true },
    });
    await Notifications.scheduleNotificationAsync({
      content: { title: 'SYSTEM // Deadline warning', body: `${activeQuests.length - completedCount} quests remain before midnight.` },
      trigger: { type: SchedulableTriggerInputTypes.CALENDAR, hour: 21, minute: 0, repeats: true },
    });
    return true;
  };

  const resetPenaltyForDemo = () => {
    setProfile((current) => ({ ...current, lockdownUntil: Date.now() + 24 * 60 * 60 * 1000, streak: 0, lastCompletedDate: null, xp: Math.max(0, current.xp - 100) }));
  };

  return (
    <QuestContext.Provider
      value={{
        quests,
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
        completeQuest,
        addQuest,
        removeQuest,
        toggleRestDay,
        completeRaid,
        scheduleReminders,
        resetPenaltyForDemo,
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