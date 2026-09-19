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

type Raid = {
  name: string;
  detail: string;
  target: number;
  unit: string;
  xp: number;
  completed: boolean;
  weekKey: string;
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

const starterQuests: Quest[] = [
  {
    id: 'pushups',
    title: '100 push-ups',
    detail: 'Build raw strength',
    category: 'TRAINING',
    target: 100,
    unit: 'reps',
    xp: 40,
    stat: 'STR',
    weekdays: [1, 2, 3, 4, 5, 6],
    completedOn: null,
  },
  {
    id: 'situps',
    title: '100 sit-ups',
    detail: 'Forge your core',
    category: 'TRAINING',
    target: 100,
    unit: 'reps',
    xp: 40,
    stat: 'STAMINA',
    weekdays: [1, 2, 3, 4, 5, 6],
    completedOn: null,
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
  xpToNext: 1500,
  rank: 'C',
  streak: 6,
  longestStreak: 12,
  stats: { STR: 28, INT: 24, STAMINA: 31, DISCIPLINE: 26 },
  title: 'The Relentless',
  lockdownUntil: null,
  lastCompletedDate: null,
};

const initialRaid: Raid = {
  name: 'The Architect’s Trial',
  detail: 'Complete every active quest twice this week',
  target: 10,
  unit: 'quests',
  xp: 300,
  completed: false,
  weekKey: '',
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

function rankForLevel(level: number): HunterProfile['rank'] {
  if (level >= 50) return 'S';
  if (level >= 35) return 'A';
  if (level >= 25) return 'B';
  if (level >= 15) return 'C';
  if (level >= 8) return 'D';
  return 'E';
}

function addXp(profile: HunterProfile, amount: number, stat: keyof HunterProfile['stats']) {
  let xp = profile.xp + amount;
  let level = profile.level;
  let xpToNext = profile.xpToNext;
  while (xp >= xpToNext) {
    xp -= xpToNext;
    level += 1;
    xpToNext = 1000 + level * 50;
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
  const [raid, setRaid] = useState<Raid>({ ...initialRaid, weekKey: weekKey() });
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
          };
          setQuests(saved.quests);
          setProfile(saved.profile);
          setRaid(saved.raid.weekKey === weekKey() ? saved.raid : { ...initialRaid, weekKey: weekKey() });
          setRestDays(saved.restDays);
        } catch {
          await AsyncStorage.removeItem(STORAGE_KEY);
        }
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (loading) return;
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ quests, profile, raid, restDays }));
  }, [loading, profile, quests, raid, restDays]);

  const activeQuests = useMemo(
    () => (restDays.includes(todayIndex) ? [] : quests.filter((quest) => quest.weekdays.includes(todayIndex))),
    [quests, restDays, todayIndex],
  );
  const completedCount = activeQuests.filter((quest) => quest.completedOn === todayKey).length;
  const completionPercent = activeQuests.length ? Math.round((completedCount / activeQuests.length) * 100) : 100;
  const isLockedDown = Boolean(profile.lockdownUntil && profile.lockdownUntil > Date.now());

  const completeQuest = (id: string) => {
    const quest = quests.find((item) => item.id === id);
    if (!quest || quest.completedOn === todayKey) return;
    setQuests((current) => current.map((item) => (item.id === id ? { ...item, completedOn: todayKey } : item)));
    setProfile((current) => {
      const next = addXp(current, quest.xp, quest.stat);
      return {
        ...next,
        lastCompletedDate: todayKey,
        streak: current.lastCompletedDate === todayKey ? current.streak : current.streak + 1,
        longestStreak: Math.max(next.longestStreak, current.streak + 1),
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
    if (raid.completed || completedCount < activeQuests.length) return;
    setRaid((current) => ({ ...current, completed: true }));
    setProfile((current) => addXp({ ...current, title: 'Breaker of the Architect', stats: { ...current.stats, DISCIPLINE: current.stats.DISCIPLINE + 3 } }, raid.xp, 'DISCIPLINE'));
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
    setProfile((current) => ({ ...current, lockdownUntil: Date.now() + 24 * 60 * 60 * 1000, streak: 0, xp: Math.max(0, current.xp - 100) }));
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