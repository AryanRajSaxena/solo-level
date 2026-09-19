import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen, SectionHeader } from '@/components/Screen';
import { useColors } from '@/hooks/useColors';
import { useQuestContext } from '@/context/QuestContext';

export default function RaidScreen() {
  const colors = useColors();
  const { raid, activeQuests, completedCount, completeRaid } = useQuestContext();
  const progress = activeQuests.length ? Math.round((completedCount / activeQuests.length) * 100) : 100;
  return (
    <Screen>
      <SectionHeader eyebrow="WEEKLY BOSS DUNGEON" title="The Architect’s Trial" />
      <View style={[styles.bossCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.bossIcon}><Feather name="zap" size={32} color="#07111c" /></View>
        <Text style={[styles.bossLabel, { color: colors.primary }]}>BOSS RAID // 01</Text>
        <Text style={[styles.bossTitle, { color: colors.foreground }]}>{raid.name}</Text>
        <Text style={[styles.bossDetail, { color: colors.mutedForeground }]}>{raid.detail}. Both your consistency and your recovery plan are tested.</Text>
        <View style={styles.rewardRow}>
          <View style={styles.reward}>
            <Feather name="award" size={17} color="#ffb25c" />
            <View><Text style={[styles.rewardLabel, { color: colors.mutedForeground }]}>RARE TITLE</Text><Text style={[styles.rewardValue, { color: colors.foreground }]}>Breaker of the Architect</Text></View>
          </View>
          <View style={styles.reward}>
            <Feather name="trending-up" size={17} color={colors.primary} />
            <View><Text style={[styles.rewardLabel, { color: colors.mutedForeground }]}>REWARD</Text><Text style={[styles.rewardValue, { color: colors.foreground }]}>+{raid.xp} XP + STAT</Text></View>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.progressHeader}>
          <Text style={[styles.progressTitle, { color: colors.foreground }]}>This week’s charge</Text>
          <Text style={[styles.progressValue, { color: colors.primary }]}>{progress}%</Text>
        </View>
        <View style={[styles.track, { backgroundColor: colors.muted }]}><View style={[styles.fill, { backgroundColor: colors.primary, width: `${progress}%` }]} /></View>
        <Text style={[styles.progressDetail, { color: colors.mutedForeground }]}>{completedCount} of {activeQuests.length} objectives cleared today. Complete the combined challenge to claim your reward.</Text>
      </View>

      <View style={[styles.ruleCard, { backgroundColor: colors.accent, borderColor: colors.border }]}>
        <Feather name="info" size={18} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.ruleTitle, { color: colors.foreground }]}>How to beat the raid</Text>
          <Text style={[styles.ruleCopy, { color: colors.mutedForeground }]}>Clear every active daily quest and keep your routine alive across the week. Rest days are respected, but skipping active quests lowers your raid progress.</Text>
        </View>
      </View>

      <Pressable onPress={completeRaid} disabled={raid.completed || completedCount < activeQuests.length} style={[styles.claimButton, { backgroundColor: raid.completed ? colors.muted : colors.primary }, (!raid.completed && completedCount < activeQuests.length) && styles.disabled]}>
        <Feather name={raid.completed ? 'check-circle' : 'unlock'} size={18} color={raid.completed ? colors.mutedForeground : colors.primaryForeground} />
        <Text style={[styles.claimText, { color: raid.completed ? colors.mutedForeground : colors.primaryForeground }]}>{raid.completed ? 'RAID CLEARED' : completedCount < activeQuests.length ? 'CLEAR TODAY’S QUESTS TO CLAIM' : 'CLAIM RAID REWARD'}</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bossCard: { borderWidth: 1, borderRadius: 22, padding: 20, alignItems: 'center' },
  bossIcon: { width: 66, height: 66, borderRadius: 22, backgroundColor: '#65d9ff', alignItems: 'center', justifyContent: 'center', marginBottom: 15 },
  bossLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.7 },
  bossTitle: { fontSize: 24, fontWeight: '800', marginTop: 7, textAlign: 'center' },
  bossDetail: { fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 8 },
  rewardRow: { width: '100%', flexDirection: 'row', gap: 14, marginTop: 21, paddingTop: 17, borderTopWidth: 1, borderTopColor: '#223551' },
  reward: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7 },
  rewardLabel: { fontSize: 8, fontWeight: '800', letterSpacing: 1.1 },
  rewardValue: { fontSize: 10, fontWeight: '700', marginTop: 4 },
  section: { marginTop: 28 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  progressTitle: { fontSize: 15, fontWeight: '700' },
  progressValue: { fontSize: 15, fontWeight: '800' },
  track: { height: 8, borderRadius: 8, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 8 },
  progressDetail: { fontSize: 12, lineHeight: 18, marginTop: 9 },
  ruleCard: { flexDirection: 'row', gap: 11, borderWidth: 1, borderRadius: 17, padding: 14, marginTop: 22 },
  ruleTitle: { fontSize: 13, fontWeight: '700' },
  ruleCopy: { fontSize: 11, lineHeight: 17, marginTop: 4 },
  claimButton: { height: 53, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: 14, marginTop: 19 },
  claimText: { fontSize: 11, fontWeight: '800', letterSpacing: 1.1 },
  disabled: { opacity: 0.45 },
});