import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen, SectionHeader, IconButton } from '@/components/Screen';
import { useColors } from '@/hooks/useColors';
import { useQuestContext, Quest } from '@/context/QuestContext';

function QuestRow({ quest, onComplete }: { quest: Quest; onComplete: () => void }) {
  const colors = useColors();
  const completed = quest.completedOn !== null;
  const categoryColor = quest.category === 'TRAINING' ? '#ffb25c' : quest.category === 'MIND' ? colors.primary : '#b693ff';
  return (
    <Pressable
      testID={`quest-${quest.id}`}
      onPress={onComplete}
      style={({ pressed }) => [
        styles.questRow,
        { backgroundColor: colors.card, borderColor: completed ? colors.primary : colors.border },
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.questIcon, { backgroundColor: `${categoryColor}20` }]}>
        <Feather name={completed ? 'check' : quest.category === 'MIND' ? 'code' : 'activity'} size={18} color={completed ? colors.primary : categoryColor} />
      </View>
      <View style={styles.questCopy}>
        <Text style={[styles.questTitle, { color: colors.foreground }, completed && styles.completedText]}>{quest.title}</Text>
        <Text style={[styles.questDetail, { color: colors.mutedForeground }]}>{quest.detail} · +{quest.xp} XP</Text>
      </View>
      <View style={[styles.questCheck, { borderColor: completed ? colors.primary : colors.border, backgroundColor: completed ? colors.primary : 'transparent' }]}>
        {completed ? <Feather name="check" size={14} color={colors.primaryForeground} /> : null}
      </View>
    </Pressable>
  );
}

export default function HomeScreen() {
  const colors = useColors();
  const router = useRouter();
  const { profile, activeQuests, completedCount, completionPercent, todayLabel, completeQuest, isLockedDown } = useQuestContext();
  const nextQuest = activeQuests.find((quest) => quest.completedOn === null);

  return (
    <Screen>
      <View style={styles.topBar}>
        <View>
          <Text style={[styles.systemLine, { color: colors.primary }]}>SYSTEM ONLINE</Text>
          <Text style={[styles.greeting, { color: colors.foreground }]}>Good evening, hunter.</Text>
        </View>
        <IconButton icon="settings" label="Open settings" onPress={() => router.push('/(tabs)/settings')} />
      </View>

      <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.heroTop}>
          <View>
            <Text style={[styles.rankLabel, { color: colors.mutedForeground }]}>CURRENT RANK</Text>
            <Text style={[styles.rank, { color: colors.primary }]}>{profile.rank}</Text>
          </View>
          <View style={styles.levelBlock}>
            <Text style={[styles.levelNumber, { color: colors.foreground }]}>LVL {profile.level}</Text>
            <Text style={[styles.titleText, { color: colors.mutedForeground }]}>{profile.title}</Text>
          </View>
        </View>
        <View style={styles.xpLine}>
          <Text style={[styles.xpText, { color: colors.foreground }]}>{profile.xp} XP</Text>
          <Text style={[styles.xpGoal, { color: colors.mutedForeground }]}>{profile.xpToNext} XP TO NEXT LEVEL</Text>
        </View>
        <View style={[styles.progressTrack, { backgroundColor: colors.muted }]}>
          <View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${Math.min(100, (profile.xp / profile.xpToNext) * 100)}%` }]} />
        </View>
        <View style={styles.heroFooter}>
          <View style={styles.streak}>
            <Feather name="zap" size={15} color="#ffb25c" />
            <Text style={[styles.streakText, { color: colors.foreground }]}>{profile.streak} day streak</Text>
          </View>
          <Text style={[styles.dateText, { color: colors.mutedForeground }]}>{todayLabel}</Text>
        </View>
      </View>

      {isLockedDown ? (
        <Pressable onPress={() => router.push('/(tabs)/settings')} style={[styles.lockdown, { backgroundColor: '#291827', borderColor: colors.destructive }]}>
          <Feather name="lock" size={18} color={colors.destructive} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.lockdownTitle, { color: colors.foreground }]}>LOCKDOWN ACTIVE</Text>
            <Text style={[styles.lockdownCopy, { color: colors.mutedForeground }]}>Your social portals are sealed for 24 hours. Return to the system settings to review the penalty.</Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.destructive} />
        </Pressable>
      ) : null}

      <View style={styles.sectionSpacing}>
        <SectionHeader eyebrow="DAILY PROTOCOL" title="Today’s quests" action="View all" onAction={() => router.push('/(tabs)/quests')} />
        <View style={styles.progressSummary}>
          <View>
            <Text style={[styles.summaryNumber, { color: colors.foreground }]}>{completedCount}<Text style={[styles.summaryTotal, { color: colors.mutedForeground }]}> / {activeQuests.length}</Text></Text>
            <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>QUESTS CLEARED</Text>
          </View>
          <View style={styles.summaryBarWrap}>
            <View style={[styles.progressTrack, { backgroundColor: colors.muted }]}>
              <View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${completionPercent}%` }]} />
            </View>
            <Text style={[styles.summaryPercent, { color: colors.primary }]}>{completionPercent}% COMPLETE</Text>
          </View>
        </View>
        {activeQuests.slice(0, 3).map((quest) => (
          <QuestRow key={quest.id} quest={quest} onComplete={() => completeQuest(quest.id)} />
        ))}
        {activeQuests.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="moon" size={20} color={colors.primary} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Rest day confirmed</Text>
            <Text style={[styles.emptyCopy, { color: colors.mutedForeground }]}>Recovery is part of the protocol. Your next quest window opens tomorrow.</Text>
          </View>
        ) : null}
      </View>

      {nextQuest ? (
        <View style={[styles.nextCard, { borderColor: colors.border, backgroundColor: colors.accent }]}>
          <View style={[styles.nextIcon, { backgroundColor: colors.primary }]}>
            <Feather name="arrow-up-right" size={17} color={colors.primaryForeground} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.nextLabel, { color: colors.primary }]}>NEXT OBJECTIVE</Text>
            <Text style={[styles.nextTitle, { color: colors.foreground }]}>{nextQuest.title}</Text>
          </View>
          <Text style={[styles.nextXp, { color: colors.foreground }]}>+{nextQuest.xp}</Text>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 },
  systemLine: { fontSize: 10, fontWeight: '800', letterSpacing: 1.8, marginBottom: 7 },
  greeting: { fontSize: 23, fontWeight: '700', letterSpacing: -0.5 },
  heroCard: { borderWidth: 1, borderRadius: 22, padding: 18 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  rankLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1.7 },
  rank: { fontSize: 52, lineHeight: 58, fontWeight: '800', letterSpacing: -2 },
  levelBlock: { alignItems: 'flex-end', paddingTop: 2 },
  levelNumber: { fontSize: 15, fontWeight: '800', letterSpacing: 0.8 },
  titleText: { fontSize: 11, marginTop: 5 },
  xpLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, marginBottom: 8 },
  xpText: { fontSize: 12, fontWeight: '700' },
  xpGoal: { fontSize: 9, letterSpacing: 1 },
  progressTrack: { height: 7, borderRadius: 8, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 8 },
  heroFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 15 },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  streakText: { fontSize: 12, fontWeight: '700' },
  dateText: { fontSize: 11 },
  lockdown: { flexDirection: 'row', alignItems: 'center', gap: 11, borderWidth: 1, borderRadius: 16, padding: 13, marginTop: 14 },
  lockdownTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  lockdownCopy: { fontSize: 11, lineHeight: 16, marginTop: 3 },
  sectionSpacing: { marginTop: 29 },
  progressSummary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 },
  summaryNumber: { fontSize: 25, fontWeight: '800' },
  summaryTotal: { fontSize: 16, fontWeight: '500' },
  summaryLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1.3, marginTop: 3 },
  summaryBarWrap: { width: '56%', alignItems: 'flex-end' },
  summaryPercent: { fontSize: 10, fontWeight: '800', letterSpacing: 1.1, marginTop: 6 },
  questRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 16, padding: 12, marginBottom: 9 },
  questIcon: { width: 39, height: 39, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  questCopy: { flex: 1 },
  questTitle: { fontSize: 14, fontWeight: '700' },
  questDetail: { fontSize: 11, marginTop: 5 },
  questCheck: { width: 25, height: 25, borderRadius: 8, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginLeft: 10 },
  completedText: { textDecorationLine: 'line-through', opacity: 0.65 },
  nextCard: { flexDirection: 'row', alignItems: 'center', gap: 11, borderWidth: 1, borderRadius: 17, padding: 13, marginTop: 14 },
  nextIcon: { width: 33, height: 33, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  nextLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1.5 },
  nextTitle: { fontSize: 14, fontWeight: '700', marginTop: 4 },
  nextXp: { fontSize: 13, fontWeight: '800' },
  empty: { borderWidth: 1, borderRadius: 18, padding: 22, alignItems: 'center' },
  emptyTitle: { fontSize: 17, fontWeight: '700', marginTop: 12 },
  emptyCopy: { fontSize: 12, textAlign: 'center', lineHeight: 18, marginTop: 6 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.99 }] },
});
