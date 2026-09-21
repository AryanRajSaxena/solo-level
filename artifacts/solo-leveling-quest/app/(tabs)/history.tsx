import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen, SectionHeader } from '@/components/Screen';
import { useQuestContext } from '@/context/QuestContext';
import { useColors } from '@/hooks/useColors';

function formatDay(key: string) {
  return new Date(`${key}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
}

export default function HistoryScreen() {
  const router = useRouter();
  const colors = useColors();
  const { completionHistory, quests } = useQuestContext();
  const days = useMemo(
    () => Object.entries(completionHistory).sort(([a], [b]) => b.localeCompare(a)),
    [completionHistory],
  );
  const questNames = useMemo(() => new Map(quests.map((quest) => [quest.id, quest.title])), [quests]);

  return (
    <Screen>
      <View style={styles.topNavRow}>
        <Pressable onPress={() => router.back()} style={[styles.backBtn, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Feather name="arrow-left" size={17} color={colors.primary} />
          <Text style={[styles.backText, { color: colors.primary }]}>BACK</Text>
        </Pressable>
        <View style={styles.protocolBadge}>
          <View style={styles.beacon} />
          <Text style={styles.protocolBadgeText}>SYSTEM ARCHIVES</Text>
        </View>
      </View>

      <SectionHeader eyebrow="LOG // HUNTER ACTIVITY" title="Quest Chronicles" />

      {days.length === 0 ? (
        <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.emptyIconCircle}>
            <Feather name="archive" size={28} color={colors.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No completed records logged</Text>
          <Text style={[styles.emptyCopy, { color: colors.mutedForeground }]}>
            Your cleared quests and daily protocols will be inscribed into the System archives.
          </Text>
        </View>
      ) : (
        days.map(([day, ids]) => (
          <View key={day} style={[styles.dayCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.dayHeader}>
              <View style={styles.dayTitleRow}>
                <Feather name="calendar" size={14} color={colors.primary} />
                <Text style={[styles.dayTitle, { color: colors.foreground }]}>{formatDay(day)}</Text>
              </View>
              <View style={styles.clearedBadge}>
                <Text style={[styles.dayCount, { color: colors.primary }]}>{ids.length} CLEARED</Text>
              </View>
            </View>
            <View style={styles.divider} />
            {ids.map((id, index) => (
              <View key={`${day}-${id}-${index}`} style={styles.questRow}>
                <View style={styles.checkIconWrap}>
                  <Feather name="check" size={12} color={colors.primary} />
                </View>
                <Text style={[styles.questName, { color: colors.foreground }]}>
                  {questNames.get(id) ?? 'Archived Protocol'}
                </Text>
                <Text style={styles.clearedTag}>COMPLETE</Text>
              </View>
            ))}
          </View>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  backText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  protocolBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(101, 217, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(101, 217, 255, 0.25)',
  },
  beacon: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#65d9ff',
  },
  protocolBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#65d9ff',
    letterSpacing: 1.2,
  },
  empty: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    marginTop: 12,
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: 'rgba(101, 217, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  emptyCopy: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 6,
  },
  dayCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginTop: 12,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dayTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dayTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  clearedBadge: {
    backgroundColor: 'rgba(101, 217, 255, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  dayCount: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: 10,
  },
  questRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  checkIconWrap: {
    width: 20,
    height: 20,
    borderRadius: 6,
    backgroundColor: 'rgba(101, 217, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  questName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  clearedTag: {
    fontSize: 8,
    fontWeight: '800',
    color: '#75e2b6',
    letterSpacing: 0.8,
  },
});

