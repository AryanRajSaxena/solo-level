import { Feather } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Screen, SectionHeader } from '@/components/Screen';
import { useQuestContext } from '@/context/QuestContext';
import { useColors } from '@/hooks/useColors';

function formatDay(key: string) {
  return new Date(`${key}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
}

export default function HistoryScreen() {
  const colors = useColors();
  const { completionHistory, quests } = useQuestContext();
  const days = useMemo(
    () => Object.entries(completionHistory).sort(([a], [b]) => b.localeCompare(a)),
    [completionHistory],
  );
  const questNames = useMemo(() => new Map(quests.map((quest) => [quest.id, quest.title])), [quests]);

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Activity log' }} />
      <SectionHeader eyebrow="SYSTEM ARCHIVES" title="Quest activity" />
      {days.length === 0 ? (
        <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="archive" size={25} color={colors.primary} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No completed quests yet</Text>
          <Text style={[styles.emptyCopy, { color: colors.mutedForeground }]}>Your completed quests will be recorded here as your hunter log.</Text>
        </View>
      ) : days.map(([day, ids]) => (
        <View key={day} style={[styles.dayCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.dayHeader}>
            <Text style={[styles.dayTitle, { color: colors.foreground }]}>{formatDay(day)}</Text>
            <Text style={[styles.dayCount, { color: colors.primary }]}>{ids.length} CLEARED</Text>
          </View>
          {ids.map((id, index) => (
            <View key={`${day}-${id}-${index}`} style={styles.questRow}>
              <Feather name="check-circle" size={15} color={colors.primary} />
              <Text style={[styles.questName, { color: colors.mutedForeground }]}>{questNames.get(id) ?? 'Archived quest'}</Text>
            </View>
          ))}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: { borderWidth: 1, borderRadius: 18, padding: 24, alignItems: 'center', marginTop: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '800', marginTop: 12 },
  emptyCopy: { fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 6 },
  dayCard: { borderWidth: 1, borderRadius: 17, padding: 14, marginTop: 12 },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  dayTitle: { fontSize: 13, fontWeight: '800' },
  dayCount: { fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  questRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
  questName: { fontSize: 12, fontWeight: '600' },
});
