import { Feather } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Screen, SectionHeader } from '@/components/Screen';
import { useColors } from '@/hooks/useColors';
import { useQuestContext } from '@/context/QuestContext';

const statMeta = [
  { key: 'STR' as const, label: 'Strength', icon: 'activity' as const, color: '#ffb25c' },
  { key: 'INT' as const, label: 'Intelligence', icon: 'cpu' as const, color: '#65d9ff' },
  { key: 'STAMINA' as const, label: 'Stamina', icon: 'heart' as const, color: '#75e2b6' },
  { key: 'DISCIPLINE' as const, label: 'Discipline', icon: 'target' as const, color: '#b693ff' },
];

export default function ProfileScreen() {
  const colors = useColors();
  const { profile } = useQuestContext();
  return (
    <Screen>
      <SectionHeader eyebrow="HUNTER PROFILE" title="Your awakening" />
      <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Feather name="user" size={28} color={colors.primaryForeground} />
        </View>
        <Text style={[styles.name, { color: colors.foreground }]}>{profile.name}</Text>
        <Text style={[styles.title, { color: colors.primary }]}>{profile.title}</Text>
        <View style={styles.rankRow}>
          <View style={styles.rankBlock}><Text style={[styles.rank, { color: colors.primary }]}>{profile.rank}</Text><Text style={[styles.label, { color: colors.mutedForeground }]}>RANK</Text></View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.metric}><Text style={[styles.metricValue, { color: colors.foreground }]}>{profile.level}</Text><Text style={[styles.label, { color: colors.mutedForeground }]}>LEVEL</Text></View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.metric}><Text style={[styles.metricValue, { color: colors.foreground }]}>{profile.longestStreak}</Text><Text style={[styles.label, { color: colors.mutedForeground }]}>BEST STREAK</Text></View>
        </View>
      </View>
      <View style={styles.section}>
        <SectionHeader eyebrow="ATTRIBUTES" title="Core stats" />
        {statMeta.map((stat) => {
          const value = profile.stats[stat.key];
          const width = Math.min(100, value * 2);
          return (
            <View key={stat.key} style={styles.statRow}>
              <View style={[styles.statIcon, { backgroundColor: `${stat.color}20` }]}><Feather name={stat.icon} size={16} color={stat.color} /></View>
              <View style={styles.statCopy}><View style={styles.statHeader}><Text style={[styles.statLabel, { color: colors.foreground }]}>{stat.label}</Text><Text style={[styles.statValue, { color: stat.color }]}>{value}</Text></View><View style={[styles.track, { backgroundColor: colors.muted }]}><View style={[styles.fill, { backgroundColor: stat.color, width: `${width}%` }]} /></View></View>
            </View>
          );
        })}
      </View>
      <View style={[styles.titleCard, { backgroundColor: colors.accent, borderColor: colors.border }]}>
        <Feather name="award" size={20} color="#ffb25c" />
        <View style={{ flex: 1 }}><Text style={[styles.titleCardLabel, { color: colors.mutedForeground }]}>EQUIPPED TITLE</Text><Text style={[styles.titleCardValue, { color: colors.foreground }]}>{profile.title}</Text></View>
        <Text style={[styles.titleCardTag, { color: colors.primary }]}>RARE</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  profileCard: { borderWidth: 1, borderRadius: 22, alignItems: 'center', padding: 20 },
  avatar: { width: 66, height: 66, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 18, fontWeight: '800', marginTop: 14, letterSpacing: 0.5 },
  title: { fontSize: 12, fontWeight: '700', marginTop: 5 },
  rankRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-around', alignItems: 'center', marginTop: 22, paddingTop: 17, borderTopWidth: 1, borderTopColor: '#223551' },
  rankBlock: { alignItems: 'center' },
  rank: { fontSize: 28, fontWeight: '800' },
  metric: { alignItems: 'center' },
  metricValue: { fontSize: 23, fontWeight: '800' },
  label: { fontSize: 8, fontWeight: '800', letterSpacing: 1.2, marginTop: 3 },
  divider: { width: 1, height: 32 },
  section: { marginTop: 28 },
  statRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  statIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  statCopy: { flex: 1 },
  statHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 7 },
  statLabel: { fontSize: 13, fontWeight: '700' },
  statValue: { fontSize: 13, fontWeight: '800' },
  track: { height: 6, borderRadius: 6, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 6 },
  titleCard: { flexDirection: 'row', alignItems: 'center', gap: 11, borderWidth: 1, borderRadius: 17, padding: 14, marginTop: 14 },
  titleCardLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
  titleCardValue: { fontSize: 14, fontWeight: '800', marginTop: 5 },
  titleCardTag: { fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
});