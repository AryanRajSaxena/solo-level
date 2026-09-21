
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View, Platform } from 'react-native';
import { Screen, SectionHeader, IconButton } from '@/components/Screen';
import { useColors } from '@/hooks/useColors';
import { useQuestContext, Quest } from '@/context/QuestContext';
import { SocialLockdownModal } from '@/components/penalty/SocialLockdownModal';

const RANK_COLORS: Record<string, string> = {
  S: '#ffd700',
  A: '#c084fc',
  B: '#00e5ff',
  C: '#4ade80',
  D: '#fb923c',
  E: '#94a3b8',
};

function QuestRow({
  quest,
  onComplete,
  onOpenSensor,
}: {
  quest: Quest;
  onComplete: () => void;
  onOpenSensor: (type: 'walk' | 'pushups' | 'situps') => void;
}) {
  const colors = useColors();
  const completed = quest.completedOn !== null;
  const isWalkQuest = quest.sensor || quest.id.includes('walk') || quest.title.toLowerCase().includes('walk');
  const isPushupQuest = quest.id.includes('pushup') || quest.title.toLowerCase().includes('push-up') || quest.title.toLowerCase().includes('pushup');
  const isSitupQuest = quest.id.includes('situp') || quest.title.toLowerCase().includes('sit-up') || quest.title.toLowerCase().includes('situp');
  const isPoseQuest = isPushupQuest || isSitupQuest;
  const isSensorQuest = isWalkQuest || isPoseQuest;

  const categoryColor = quest.category === 'TRAINING' ? '#ffb25c' : quest.category === 'MIND' ? colors.primary : '#b693ff';

  const handlePress = () => {
    if (isWalkQuest && !completed) {
      onOpenSensor('walk');
    } else if (isPushupQuest && !completed) {
      onOpenSensor('pushups');
    } else if (isSitupQuest && !completed) {
      onOpenSensor('situps');
    } else {
      onComplete();
    }
  };

  return (
    <Pressable
      testID={`quest-${quest.id}`}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.questRow,
        {
          backgroundColor: completed ? 'rgba(17, 24, 39, 0.6)' : colors.card,
          borderColor: completed ? 'rgba(101, 217, 255, 0.4)' : isSensorQuest ? 'rgba(0, 229, 255, 0.35)' : colors.border,
        },
        pressed && styles.pressed,
      ]}
    >
      <View
        style={[
          styles.questIcon,
          {
            backgroundColor: completed ? 'rgba(101, 217, 255, 0.12)' : `${categoryColor}18`,
            borderColor: completed ? colors.primary : `${categoryColor}40`,
          },
        ]}
      >
        <Feather
          name={
            completed
              ? 'check'
              : isWalkQuest
              ? 'navigation'
              : isPoseQuest
              ? 'video'
              : quest.category === 'MIND'
              ? 'code'
              : 'activity'
          }
          size={18}
          color={completed ? colors.primary : isSensorQuest ? colors.primary : categoryColor}
        />
      </View>

      <View style={styles.questCopy}>
        <Text style={[styles.questTitle, { color: colors.foreground }, completed && styles.completedText]}>
          {quest.title}
        </Text>
        <Text style={[styles.questDetail, { color: colors.mutedForeground }]}>
          {quest.detail} · +{quest.xp} XP
        </Text>
      </View>

      <View
        style={[
          styles.questCheck,
          {
            borderColor: completed ? colors.primary : isSensorQuest ? colors.primary : colors.border,
            backgroundColor: completed ? colors.primary : 'rgba(0, 229, 255, 0.05)',
          },
        ]}
      >
        {completed ? (
          <Feather name="check" size={14} color={colors.primaryForeground} />
        ) : isWalkQuest ? (
          <Feather name="navigation" size={12} color={colors.primary} />
        ) : isPoseQuest ? (
          <Feather name="camera" size={12} color={colors.primary} />
        ) : null}
      </View>
    </Pressable>
  );
}

export default function HomeScreen() {
  const colors = useColors();
  const router = useRouter();
  const { profile, activeQuests, completedCount, completionPercent, completeQuest, isLockedDown, clearPenalty } = useQuestContext();
  const [showLockdownModal, setShowLockdownModal] = useState(false);
  const nextQuest = activeQuests.find((quest) => quest.completedOn === null);
  const rankColor = RANK_COLORS[profile.rank] ?? colors.primary;

  return (
    <Screen>
      <View style={styles.topBar}>
        <View>
          <View style={styles.systemTagRow}>
            <View style={styles.beacon} />
            <Text style={[styles.systemLine, { color: colors.primary }]}>SYSTEM ONLINE // PROTOCOL V2</Text>
          </View>
          <Text style={[styles.greeting, { color: colors.foreground }]}>Good evening, Hunter.</Text>
        </View>
        <IconButton icon="settings" label="Open settings" onPress={() => router.push('/(tabs)/settings')} />
      </View>

      {/* SOLO LEVELING HUNTER STATUS CARD */}
      <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: 'rgba(101, 217, 255, 0.25)' }]}>
        <View style={styles.heroTop}>
          <View style={styles.rankContainer}>
            <Text style={[styles.rank, { color: rankColor }]}>{profile.rank}</Text>
            <View>
              <Text style={[styles.rankLabel, { color: colors.mutedForeground }]}>CURRENT RANK</Text>
              <Text style={[styles.awakeningState, { color: rankColor }]}>Awakened Hunter</Text>
            </View>
          </View>

          <View style={styles.levelBlock}>
            <View style={styles.levelBadge}>
              <Text style={styles.levelNumber}>LVL {profile.level}</Text>
            </View>
          </View>
        </View>

        {/* XP PROGRESS BAR */}
        <View style={styles.xpLine}>
          <Text style={[styles.xpText, { color: colors.foreground }]}>{profile.xp} XP</Text>
          <Text style={[styles.xpGoal, { color: colors.mutedForeground }]}>{profile.xpToNext} XP TO NEXT LEVEL</Text>
        </View>
        <View style={[styles.progressTrack, { backgroundColor: colors.muted }]}>
          <View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${Math.min(100, (profile.xp / profile.xpToNext) * 100)}%` }]} />
        </View>

        {/* STAT PILLS ROW */}
        <View style={styles.statPillsRow}>
          <View style={styles.statPill}>
            <Text style={styles.statPillKey}>STR</Text>
            <Text style={[styles.statPillVal, { color: '#ffb25c' }]}>{profile.stats.STR}</Text>
          </View>
          <View style={styles.statPill}>
            <Text style={styles.statPillKey}>INT</Text>
            <Text style={[styles.statPillVal, { color: '#65d9ff' }]}>{profile.stats.INT}</Text>
          </View>
          <View style={styles.statPill}>
            <Text style={styles.statPillKey}>STM</Text>
            <Text style={[styles.statPillVal, { color: '#75e2b6' }]}>{profile.stats.STAMINA}</Text>
          </View>
          <View style={styles.statPill}>
            <Text style={styles.statPillKey}>DISC</Text>
            <Text style={[styles.statPillVal, { color: '#b693ff' }]}>{profile.stats.DISCIPLINE}</Text>
          </View>
        </View>

        {/* FOOTER */}
        <View style={styles.heroFooter}>
          <View style={styles.streak}>
            <Feather name="zap" size={15} color="#ffb25c" />
            <Text style={[styles.streakText, { color: colors.foreground }]}>{profile.streak} day streak</Text>
          </View>
        </View>
      </View>

      {isLockedDown ? (
        <Pressable onPress={() => setShowLockdownModal(true)} style={[styles.lockdown, { backgroundColor: '#291827', borderColor: colors.destructive }]}>
          <Feather name="lock" size={18} color={colors.destructive} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.lockdownTitle, { color: colors.foreground }]}>LOCKDOWN ACTIVE // PORTALS SEALED</Text>
            <Text style={[styles.lockdownCopy, { color: colors.mutedForeground }]}>Social & shopping apps are locked by System directive. Tap to inspect sealed portals & countdown.</Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.destructive} />
        </Pressable>
      ) : null}

      {/* DAILY QUESTS SECTION */}
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
          <QuestRow
            key={quest.id}
            quest={quest}
            onComplete={() => completeQuest(quest.id)}
            onOpenSensor={(type) => {
              if (type === 'walk') {
                router.push({ pathname: '/walk-quest' } as any);
              } else {
                router.push({ pathname: '/pose-tracker' as any, params: { exercise: type, questId: quest.id } });
              }
            }}
          />
        ))}
        {activeQuests.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="moon" size={20} color={colors.primary} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Rest day confirmed</Text>
            <Text style={[styles.emptyCopy, { color: colors.mutedForeground }]}>Recovery is part of the protocol. Your next quest window opens tomorrow.</Text>
          </View>
        ) : null}
      </View>

      {/* NEXT OBJECTIVE CARD */}
      {nextQuest ? (
        <Pressable
          onPress={() => {
            const isWalk = nextQuest.sensor || nextQuest.id.includes('walk') || nextQuest.title.toLowerCase().includes('walk');
            const isPushup = nextQuest.id.includes('pushup') || nextQuest.title.toLowerCase().includes('push-up') || nextQuest.title.toLowerCase().includes('pushup');
            const isSitup = nextQuest.id.includes('situp') || nextQuest.title.toLowerCase().includes('sit-up') || nextQuest.title.toLowerCase().includes('situp');

            if (isWalk) {
              router.push({ pathname: '/walk-quest' } as any);
            } else if (isPushup) {
              router.push({ pathname: '/pose-tracker' as any, params: { exercise: 'pushups', questId: nextQuest.id } });
            } else if (isSitup) {
              router.push({ pathname: '/pose-tracker' as any, params: { exercise: 'situps', questId: nextQuest.id } });
            } else {
              router.push('/(tabs)/quests');
            }
          }}
          style={({ pressed }) => [
            styles.nextCard,
            { borderColor: 'rgba(101, 217, 255, 0.3)', backgroundColor: colors.accent },
            pressed && styles.pressed,
          ]}
        >
          <View style={[styles.nextIcon, { backgroundColor: colors.primary }]}>
            <Feather
              name={
                nextQuest.sensor || nextQuest.title.toLowerCase().includes('walk')
                  ? 'navigation'
                  : nextQuest.id.includes('pushup') || nextQuest.id.includes('situp')
                  ? 'camera'
                  : 'arrow-up-right'
              }
              size={17}
              color={colors.primaryForeground}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.nextLabel, { color: colors.primary }]}>NEXT OBJECTIVE</Text>
            <Text style={[styles.nextTitle, { color: colors.foreground }]}>{nextQuest.title}</Text>
          </View>
          <Text style={[styles.nextXp, { color: colors.foreground }]}>+{nextQuest.xp} XP</Text>
        </Pressable>
      ) : null}

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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  systemTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  beacon: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#65d9ff',
  },
  systemLine: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  heroCard: {
    borderWidth: 1.5,
    borderRadius: 22,
    padding: 18,
    shadowColor: '#65d9ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 14,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rankContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rankLabel: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  rank: {
    fontSize: 54,
    lineHeight: 58,
    fontWeight: '900',
    letterSpacing: -1,
  },
  awakeningState: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  levelBlock: {
    alignItems: 'flex-end',
  },
  levelBadge: {
    backgroundColor: 'rgba(101, 217, 255, 0.15)',
    borderWidth: 1,
    borderColor: '#65d9ff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  levelNumber: {
    fontSize: 14,
    fontWeight: '900',
    color: '#65d9ff',
    letterSpacing: 1,
  },
  xpLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 8,
  },
  xpText: {
    fontSize: 12,
    fontWeight: '800',
  },
  xpGoal: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  progressTrack: {
    height: 7,
    borderRadius: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 8,
  },
  statPillsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  statPill: {
    alignItems: 'center',
    backgroundColor: 'rgba(7, 11, 19, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  statPillKey: {
    fontSize: 8,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.5)',
    letterSpacing: 1,
  },
  statPillVal: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
  },
  heroFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
  },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  streakText: {
    fontSize: 12,
    fontWeight: '700',
  },
  lockdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderWidth: 1,
    borderRadius: 16,
    padding: 13,
    marginTop: 14,
  },
  lockdownTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  lockdownCopy: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
  },
  sectionSpacing: {
    marginTop: 26,
  },
  progressSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 13,
  },
  summaryNumber: {
    fontSize: 25,
    fontWeight: '800',
  },
  summaryTotal: {
    fontSize: 16,
    fontWeight: '500',
  },
  summaryLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.3,
    marginTop: 3,
  },
  summaryBarWrap: {
    width: '56%',
    alignItems: 'flex-end',
  },
  summaryPercent: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
    marginTop: 6,
  },
  questRow: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    marginBottom: 9,
  },
  questIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  questCopy: {
    flex: 1,
  },
  questTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  questDetail: {
    fontSize: 11,
    marginTop: 4,
  },
  questCheck: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  completedText: {
    textDecorationLine: 'line-through',
    opacity: 0.65,
  },
  nextCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderWidth: 1.5,
    borderRadius: 18,
    padding: 14,
    marginTop: 14,
  },
  nextIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextLabel: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  nextTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 3,
  },
  nextXp: {
    fontSize: 13,
    fontWeight: '800',
  },
  empty: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 22,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginTop: 12,
  },
  emptyCopy: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 6,
  },
  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.99 }],
  },
});

