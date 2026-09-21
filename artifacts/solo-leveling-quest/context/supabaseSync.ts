/**
 * supabaseSync.ts
 *
 * Direct Supabase sync layer - replaces the Python FastAPI backend entirely.
 * All calls go from the browser to Supabase using the anon key + user JWT,
 * which respects Row Level Security policies.
 *
 * Business logic (XP, leveling, streak) is computed in QuestContext.tsx and
 * passed in as profileUpdates to keep this file as a pure data layer.
 */
import { supabase } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Types mirroring what QuestContext.tsx uses
// ---------------------------------------------------------------------------

export type SyncableState = {
  profile: {
    name: string;
    level: number;
    xp: number;
    xpToNext: number;
    rank: 'E' | 'D' | 'C' | 'B' | 'A' | 'S';
    streak: number;
    longestStreak: number;
    stats: { STR: number; INT: number; STAMINA: number; DISCIPLINE: number };
    title: string;
    lockdownUntil: number | null;
    lastCompletedDate: string | null;
  };
  quests: Array<{
    id: string;
    title: string;
    detail: string;
    category: 'TRAINING' | 'MIND' | 'DISCIPLINE' | 'RECOVERY';
    target: number;
    unit: string;
    xp: number;
    stat: 'STR' | 'INT' | 'STAMINA' | 'DISCIPLINE';
    weekdays: number[];
    completedOn: string | null;
    isCustom?: boolean;
    rampKey?: 'PUSHUPS' | 'SITUPS';
  }>;
  restDays: number[];
  dailyHistory: Record<string, string[]>;
  raid: {
    id: string;
    name: string;
    detail: string;
    target: number;
    unit: string;
    xp: number;
    status: string;
    weekKey: string;
    requiredQuestIds: string[];
    evaluatedAt: string | null;
  } | null;
  lastRaid: {
    id: string;
    name: string;
    detail: string;
    target: number;
    unit: string;
    xp: number;
    status: string;
    weekKey: string;
    requiredQuestIds: string[];
    evaluatedAt: string | null;
  } | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Current week's Sunday ISO date (YYYY-MM-DD) */
function currentWeekKey(): string {
  const now = new Date();
  const sunday = new Date(now);
  sunday.setUTCDate(now.getUTCDate() - now.getUTCDay());
  return sunday.toISOString().slice(0, 10);
}

function mapProfileRow(p: Record<string, unknown>) {
  return {
    name: (p.name as string) ?? 'AWAKENED HUNTER',
    level: (p.level as number) ?? 1,
    xp: (p.xp as number) ?? 0,
    xpToNext: (p.xp_to_next as number) ?? 1000,
    rank: ((p.rank as string) ?? 'E') as 'E' | 'D' | 'C' | 'B' | 'A' | 'S',
    streak: (p.streak as number) ?? 0,
    longestStreak: (p.longest_streak as number) ?? 0,
    stats: {
      STR: (p.stat_str as number) ?? 1,
      INT: (p.stat_int as number) ?? 1,
      STAMINA: (p.stat_stamina as number) ?? 1,
      DISCIPLINE: (p.stat_discipline as number) ?? 1,
    },
    title: (p.title as string) ?? 'E-Rank Hunter',
    lockdownUntil: p.lockdown_until
      ? new Date(p.lockdown_until as string).getTime()
      : null,
    lastCompletedDate: (p.last_completed_date as string) ?? null,
  };
}

function mapQuestRow(
  q: Record<string, unknown>,
  completions: Array<Record<string, unknown>>
) {
  const today = todayIso();
  const dates = completions
    .filter((c) => c.quest_id === q.id)
    .map((c) => c.completed_date as string);
  return {
    id: q.id as string,
    title: q.title as string,
    detail: (q.detail as string) ?? '',
    category: (q.category as 'TRAINING' | 'MIND' | 'DISCIPLINE' | 'RECOVERY') ?? 'DISCIPLINE',
    target: (q.target as number) ?? 1,
    unit: (q.unit as string) ?? 'set',
    xp: (q.xp as number) ?? 25,
    stat: (q.stat as 'STR' | 'INT' | 'STAMINA' | 'DISCIPLINE') ?? 'DISCIPLINE',
    weekdays: (q.weekdays as number[]) ?? [0, 1, 2, 3, 4, 5, 6],
    completedOn: dates.includes(today) ? today : null,
    isCustom: (q.is_custom as boolean) ?? false,
    rampKey: (q.ramp_key as 'PUSHUPS' | 'SITUPS' | null) ?? undefined,
    sensor: (q.id as string).includes('walk_3km') || ((q.title as string) ?? '').toLowerCase().includes('walk'),
  };
}

function mapRaidRow(r: Record<string, unknown> | null) {
  if (!r) return null;
  return {
    id: r.id as string,
    name: (r.name as string) ?? "The Architect's Trial",
    detail: (r.detail as string) ?? 'Complete every active quest twice this week',
    target: (r.target as number) ?? 0,
    unit: (r.unit as string) ?? 'completions',
    xp: (r.xp as number) ?? 300,
    status: (r.status as string) ?? 'ACTIVE',
    weekKey: (r.week_key as string) ?? '',
    requiredQuestIds: (r.required_quest_ids as string[]) ?? [],
    evaluatedAt: (r.evaluated_at as string) ?? null,
  };
}

// ---------------------------------------------------------------------------
// Starter quests seeder
// ---------------------------------------------------------------------------

const STARTER_QUESTS = (userId: string) => [
  { id: `${userId}_pushups`, user_id: userId, title: '100 push-ups', detail: 'Build raw strength', category: 'TRAINING', target: 20, unit: 'reps', xp: 40, stat: 'STR', weekdays: [1, 2, 3, 4, 5, 6], is_custom: false, ramp_key: 'PUSHUPS' },
  { id: `${userId}_situps`, user_id: userId, title: '20 sit-ups', detail: 'Forge your core', category: 'TRAINING', target: 20, unit: 'reps', xp: 40, stat: 'STAMINA', weekdays: [1, 2, 3, 4, 5, 6], is_custom: false, ramp_key: 'SITUPS' },
  { id: `${userId}_gym`, user_id: userId, title: 'Gym regimen', detail: '45 min minimum', category: 'TRAINING', target: 45, unit: 'min', xp: 55, stat: 'STAMINA', weekdays: [1, 3, 5], is_custom: false, ramp_key: null },
  { id: `${userId}_coding`, user_id: userId, title: 'Deep work coding', detail: 'No distractions', category: 'MIND', target: 60, unit: 'min', xp: 65, stat: 'INT', weekdays: [0, 1, 2, 3, 4, 5, 6], is_custom: false, ramp_key: null },
  { id: `${userId}_gum`, user_id: userId, title: 'Chew gum', detail: 'Sharpen the jawline', category: 'DISCIPLINE', target: 20, unit: 'min', xp: 15, stat: 'DISCIPLINE', weekdays: [0, 1, 2, 3, 4, 5, 6], is_custom: false, ramp_key: null },
  { id: `${userId}_walk_3km`, user_id: userId, title: 'Walk 3 km', detail: 'Traverse the gate on foot', category: 'TRAINING', target: 3, unit: 'km', xp: 150, stat: 'STAMINA', weekdays: [0, 1, 2, 3, 4, 5, 6], is_custom: false, ramp_key: null },
];

export async function seedStarterQuests(userId: string): Promise<Array<Record<string, unknown>>> {
  const { data, error } = await supabase
    .from('quests')
    .insert(STARTER_QUESTS(userId))
    .select();
  if (error) {
    console.error('[sync] seedStarterQuests error:', error.message);
    return [];
  }
  return (data ?? []) as Array<Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// Fetch full server state
// ---------------------------------------------------------------------------

/**
 * Pull full state from Supabase. Returns null on failure (offline / not authed).
 * Called once on app launch after local AsyncStorage hydration.
 */
export async function fetchServerState(): Promise<SyncableState | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const userId = user.id;
    const weekKey = currentWeekKey();

    // Fetch everything in parallel
    const [profileRes, questsRes, completionsRes, restDaysRes, currentRaidRes, lastRaidRes] =
      await Promise.all([
        supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('quests').select('*').eq('user_id', userId),
        supabase.from('daily_completions').select('*').eq('user_id', userId),
        supabase.from('rest_days').select('day').eq('user_id', userId),
        supabase.from('raids').select('*').eq('user_id', userId).eq('is_current', true).maybeSingle(),
        supabase.from('raids').select('*').eq('user_id', userId).eq('is_current', false).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ]);

    // Create profile if it doesn't exist
    let profileRow: Record<string, unknown>;
    if (!profileRes.data) {
      const { data: newProfile, error: insertErr } = await supabase
        .from('profiles')
        .insert({ user_id: userId })
        .select()
        .single();
      if (insertErr || !newProfile) {
        console.error('[sync] Failed to create profile:', insertErr?.message);
        return null;
      }
      profileRow = newProfile as Record<string, unknown>;
    } else {
      profileRow = profileRes.data as Record<string, unknown>;
    }

    // Seed starter quests if none
    let questRows: Array<Record<string, unknown>> = (questsRes.data ?? []) as Array<Record<string, unknown>>;
    if (questRows.length === 0) {
      questRows = await seedStarterQuests(userId);
    }

    const completionRows: Array<Record<string, unknown>> = (completionsRes.data ?? []) as Array<Record<string, unknown>>;
    const restDayNums: number[] = restDaysRes.data ? restDaysRes.data.map((r) => r.day as number) : [0];

    // Build daily history map
    const dailyHistory: Record<string, string[]> = {};
    for (const c of completionRows) {
      const d = c.completed_date as string;
      dailyHistory[d] = [...(dailyHistory[d] ?? []), c.quest_id as string];
    }

    // Ensure current raid exists for this week
    let currentRaidRow: Record<string, unknown> | null =
      (currentRaidRes.data as Record<string, unknown> | null) ?? null;

    if (!currentRaidRow || (currentRaidRow.week_key as string) !== weekKey) {
      if (currentRaidRow && (currentRaidRow.week_key as string) < weekKey) {
        await supabase.from('raids').update({ is_current: false }).eq('id', currentRaidRow.id as string);
      }
      const requiredIds = questRows
        .filter((q) => {
          const weekdays = q.weekdays as number[];
          return Array.from({ length: 7 }, (_, i) => {
            const d = new Date(weekKey + 'T00:00:00.000Z');
            d.setUTCDate(d.getUTCDate() + i);
            return d.getUTCDay();
          }).some((dow) => weekdays.includes(dow));
        })
        .map((q) => q.id as string);

      const { data: newRaid } = await supabase
        .from('raids')
        .insert({
          user_id: userId,
          week_key: weekKey,
          required_quest_ids: requiredIds,
          target: requiredIds.length * 2,
          is_current: true,
          status: 'ACTIVE',
        })
        .select()
        .single();
      currentRaidRow = (newRaid as Record<string, unknown> | null) ?? null;
    }

    const lastRaidRow: Record<string, unknown> | null =
      (lastRaidRes.data as Record<string, unknown> | null) ?? null;

    return {
      profile: mapProfileRow(profileRow),
      quests: questRows.map((q) => mapQuestRow(q, completionRows)),
      restDays: restDayNums,
      dailyHistory,
      raid: mapRaidRow(currentRaidRow),
      lastRaid: mapRaidRow(lastRaidRow),
    };
  } catch (error) {
    console.error('[sync] fetchServerState failed:', error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Sync operations - fire-and-forget; errors are logged, never thrown
// ---------------------------------------------------------------------------

/**
 * Record a quest completion and update profile progression in Supabase.
 * profileUpdates is the post-completion snapshot computed by QuestContext.
 */
export function syncQuestCompletion(
  questId: string,
  profileUpdates: {
    xp: number;
    level: number;
    xpToNext: number;
    rank: string;
    statKey: string;
    statValue: number;
    streak?: number;
    longestStreak?: number;
    lastCompletedDate?: string | null;
  }
): void {
  void (async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = todayIso();

      const { error: compErr } = await supabase
        .from('daily_completions')
        .upsert(
          { user_id: user.id, quest_id: questId, completed_date: today },
          { onConflict: 'user_id,quest_id,completed_date' }
        );
      if (compErr) console.error('[sync] completion upsert error:', compErr.message);

      const updates: Record<string, unknown> = {
        xp: profileUpdates.xp,
        level: profileUpdates.level,
        xp_to_next: profileUpdates.xpToNext,
        rank: profileUpdates.rank,
        [profileUpdates.statKey]: profileUpdates.statValue,
      };
      if (profileUpdates.streak !== undefined) updates.streak = profileUpdates.streak;
      if (profileUpdates.longestStreak !== undefined) updates.longest_streak = profileUpdates.longestStreak;
      if (profileUpdates.lastCompletedDate !== undefined) updates.last_completed_date = profileUpdates.lastCompletedDate;

      const { error: profErr } = await supabase
        .from('profiles')
        .update(updates)
        .eq('user_id', user.id);
      if (profErr) console.error('[sync] profile update error:', profErr.message);
    } catch (e) {
      console.error('[sync] syncQuestCompletion failed:', e);
    }
  })();
}

/** Insert a new custom quest. */
export function syncNewQuest(quest: {
  id: string;
  title: string;
  detail: string;
  category: string;
  target: number;
  unit: string;
  xp: number;
  stat: string;
  weekdays: number[];
}): void {
  void (async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase.from('quests').insert({
        ...quest,
        user_id: user.id,
        is_custom: true,
      });
      if (error) console.error('[sync] syncNewQuest error:', error.message);
    } catch (e) {
      console.error('[sync] syncNewQuest failed:', e);
    }
  })();
}

/** Delete a quest. Tries exact id, then user-scoped id. */
export function syncDeleteQuest(questId: string): void {
  void (async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('quests').delete().eq('user_id', user.id).eq('id', questId);
      await supabase.from('quests').delete().eq('user_id', user.id).eq('id', `${user.id}_${questId}`);
    } catch (e) {
      console.error('[sync] syncDeleteQuest failed:', e);
    }
  })();
}

/** Replace all rest days for this user. */
export function syncRestDays(days: number[]): void {
  void (async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('rest_days').delete().eq('user_id', user.id);
      if (days.length > 0) {
        const { error } = await supabase
          .from('rest_days')
          .insert(days.map((day) => ({ user_id: user.id, day })));
        if (error) console.error('[sync] syncRestDays insert error:', error.message);
      }
    } catch (e) {
      console.error('[sync] syncRestDays failed:', e);
    }
  })();
}

/** Apply or clear penalty lockdown in Supabase. */
export function syncPenalty(profileUpdates: { lockdownUntil: number | null; xp: number }): void {
  void (async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase
        .from('profiles')
        .update({
          lockdown_until: profileUpdates.lockdownUntil ? new Date(profileUpdates.lockdownUntil).toISOString() : null,
          ...(profileUpdates.lockdownUntil ? { streak: 0, last_completed_date: null } : {}),
          xp: profileUpdates.xp,
        })
        .eq('user_id', user.id);
      if (error) console.error('[sync] syncPenalty error:', error.message);
    } catch (e) {
      console.error('[sync] syncPenalty failed:', e);
    }
  })();
}

/** Claim a passed raid and update profile. */
export function syncRaidClaim(
  raidId: string,
  profileUpdates: {
    xp: number;
    level: number;
    xpToNext: number;
    rank: string;
    title: string;
    statDiscipline: number;
  }
): void {
  void (async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('raids').update({ status: 'CLAIMED' }).eq('id', raidId);
      const { error } = await supabase
        .from('profiles')
        .update({
          xp: profileUpdates.xp,
          level: profileUpdates.level,
          xp_to_next: profileUpdates.xpToNext,
          rank: profileUpdates.rank,
          title: profileUpdates.title,
          stat_discipline: profileUpdates.statDiscipline,
        })
        .eq('user_id', user.id);
      if (error) console.error('[sync] syncRaidClaim error:', error.message);
    } catch (e) {
      console.error('[sync] syncRaidClaim failed:', e);
    }
  })();
}

/** Update hunter profile fields in Supabase. */
export function syncProfile(updates: {
  name?: string;
  title?: string;
  journey_start_date?: string;
  xp?: number;
  level?: number;
  xpToNext?: number;
  rank?: string;
  stat_discipline?: number;
}): void {
  void (async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const payload: Record<string, unknown> = {};
      if (updates.name !== undefined) payload.name = updates.name;
      if (updates.title !== undefined) payload.title = updates.title;
      if (updates.journey_start_date !== undefined) payload.journey_start_date = updates.journey_start_date;
      if (updates.xp !== undefined) payload.xp = updates.xp;
      if (updates.level !== undefined) payload.level = updates.level;
      if (updates.xpToNext !== undefined) payload.xp_to_next = updates.xpToNext;
      if (updates.rank !== undefined) payload.rank = updates.rank;
      if (updates.stat_discipline !== undefined) payload.stat_discipline = updates.stat_discipline;
      if (Object.keys(payload).length === 0) return;

      const { error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('user_id', user.id);
      if (error) console.error('[sync] syncProfile error:', error.message);
    } catch (e) {
      console.error('[sync] syncProfile failed:', e);
    }
  })();
}
