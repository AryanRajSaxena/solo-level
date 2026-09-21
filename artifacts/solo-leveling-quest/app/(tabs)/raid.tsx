import { Feather } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View, Platform } from 'react-native';
import { Screen, SectionHeader } from '@/components/Screen';
import { useColors } from '@/hooks/useColors';
import { useQuestContext } from '@/context/QuestContext';

export default function RaidScreen() {
  const colors = useColors();
  const { raid, raidProgress, raidPercent } = useQuestContext();

  return (
    <Screen>
      <SectionHeader eyebrow="[SYSTEM PROTOCOL // DUNGEON GATE]" title="The Architect’s Trial" />

      {/* COMING SOON SYSTEM NOTICE BANNER */}
      <View style={styles.comingSoonBanner}>
        <View style={styles.bannerHeaderRow}>
          <View style={styles.redBeacon} />
          <Text style={styles.bannerEyebrow}>[SYSTEM NOTICE] DIMENSIONAL GATE SEALED</Text>
          <View style={styles.comingSoonBadge}>
            <Text style={styles.comingSoonBadgeText}>COMING SOON</Text>
          </View>
        </View>
        <Text style={styles.bannerTitle}>Class-S Red Gate Detected</Text>
        <Text style={styles.bannerCopy}>
          Dimensional resonance frequency is currently unstable. The Monarch’s Gate barrier is locked by the System protocol. Boss raid encounters and party deployments will unlock in an upcoming System upgrade.
        </Text>
        <View style={styles.telemetryPillsRow}>
          <View style={styles.telemetryPill}>
            <Feather name="shield" size={11} color="#ff5470" />
            <Text style={styles.telemetryPillText}>BARRIER INTEGRITY: 100%</Text>
          </View>
          <View style={styles.telemetryPill}>
            <Feather name="activity" size={11} color="#ffb25c" />
            <Text style={styles.telemetryPillText}>GATE RANK: S-CLASS</Text>
          </View>
        </View>
      </View>

      {/* BOSS RAID CARD */}
      <View style={[styles.bossCard, { backgroundColor: colors.card, borderColor: 'rgba(255, 84, 112, 0.35)' }]}>
        <View style={styles.bossBadgeRow}>
          <View style={styles.gateTag}>
            <Text style={styles.gateTagText}>RED GATE // 01</Text>
          </View>
          <View style={styles.lockedPill}>
            <Feather name="lock" size={11} color="#ff5470" />
            <Text style={styles.lockedPillText}>INACTIVE</Text>
          </View>
        </View>

        <View style={styles.bossIcon}>
          <Feather name="zap" size={32} color="#07111c" />
        </View>

        <Text style={[styles.bossLabel, { color: colors.primary }]}>WEEKLY BOSS DUNGEON</Text>
        <Text style={[styles.bossTitle, { color: colors.foreground }]}>{raid.name}</Text>
        <Text style={[styles.bossDetail, { color: colors.mutedForeground }]}>
          {raid.detail}. Rest days are excluded from the requirement, and the result is evaluated once after the week closes.
        </Text>

        {/* REWARDS SECTION */}
        <View style={styles.rewardRow}>
          <View style={styles.reward}>
            <View style={styles.rewardIconWrap}>
              <Feather name="award" size={16} color="#ffb25c" />
            </View>
            <View>
              <Text style={[styles.rewardLabel, { color: colors.mutedForeground }]}>RARE TITLE</Text>
              <Text style={[styles.rewardValue, { color: colors.foreground }]}>Breaker of the Architect</Text>
            </View>
          </View>
          <View style={styles.reward}>
            <View style={[styles.rewardIconWrap, { backgroundColor: 'rgba(101, 217, 255, 0.15)' }]}>
              <Feather name="trending-up" size={16} color={colors.primary} />
            </View>
            <View>
              <Text style={[styles.rewardLabel, { color: colors.mutedForeground }]}>REWARD</Text>
              <Text style={[styles.rewardValue, { color: colors.foreground }]}>+{raid.xp} XP + STAT</Text>
            </View>
          </View>
        </View>
      </View>

      {/* WEEKLY CHARGE SECTION */}
      <View style={styles.section}>
        <View style={styles.progressHeader}>
          <View>
            <Text style={[styles.progressEyebrow, { color: colors.primary }]}>DUNGEON MANA CHARGE</Text>
            <Text style={[styles.progressTitle, { color: colors.foreground }]}>This week’s charge</Text>
          </View>
          <Text style={[styles.progressValue, { color: colors.primary }]}>{raidPercent}%</Text>
        </View>
        <View style={[styles.track, { backgroundColor: colors.muted }]}>
          <View style={[styles.fill, { backgroundColor: colors.primary, width: `${raidPercent}%` }]} />
        </View>
        <Text style={[styles.progressDetail, { color: colors.mutedForeground }]}>
          {raidProgress} of {raid.target} required completions logged. Each quest must be cleared twice during the week to contribute mana.
        </Text>
      </View>

      {/* RAID RULES */}
      <View style={[styles.ruleCard, { backgroundColor: colors.accent, borderColor: colors.border }]}>
        <Feather name="info" size={18} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.ruleTitle, { color: colors.foreground }]}>How to beat the raid</Text>
          <Text style={[styles.ruleCopy, { color: colors.mutedForeground }]}>
            The scheduled job evaluates the closed week once. A pass requires two completions for every quest scheduled during the week. Once the Dimensional Gate is unsealed in the next Protocol version, rewards will automatically be unlocked.
          </Text>
        </View>
      </View>

      {/* DEACTIVATED / COMING SOON BUTTON */}
      <View style={styles.lockedButtonContainer}>
        <View style={styles.lockedButton}>
          <Feather name="lock" size={17} color="#ff5470" />
          <Text style={styles.lockedButtonText}>DUNGEON GATE SEALED (COMING SOON)</Text>
        </View>
        <Text style={styles.lockedButtonHelper}>
          [SYSTEM LOCK] Raid activation restricted pending future Protocol release.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  comingSoonBanner: {
    borderWidth: 1.5,
    borderColor: 'rgba(255, 84, 112, 0.5)',
    backgroundColor: 'rgba(255, 84, 112, 0.08)',
    borderRadius: 20,
    padding: 16,
    marginBottom: 18,
    gap: 8,
    shadowColor: '#ff5470',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  bannerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  redBeacon: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff5470',
  },
  bannerEyebrow: {
    fontSize: 9,
    fontWeight: '900',
    color: '#ff5470',
    letterSpacing: 1.5,
    flex: 1,
  },
  comingSoonBadge: {
    backgroundColor: 'rgba(255, 84, 112, 0.25)',
    borderWidth: 1,
    borderColor: '#ff5470',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  comingSoonBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#ff5470',
    letterSpacing: 1,
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  bannerCopy: {
    fontSize: 11,
    lineHeight: 16,
    color: 'rgba(255, 255, 255, 0.75)',
  },
  telemetryPillsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  telemetryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(7, 11, 19, 0.6)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  telemetryPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.7)',
    letterSpacing: 0.8,
  },
  bossCard: {
    borderWidth: 1.5,
    borderRadius: 22,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#ff5470',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
  },
  bossBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 14,
  },
  gateTag: {
    backgroundColor: 'rgba(255, 84, 112, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 84, 112, 0.4)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  gateTagText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#ff5470',
    letterSpacing: 1.2,
  },
  lockedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(7, 11, 19, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255, 84, 112, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  lockedPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#ff5470',
    letterSpacing: 1,
  },
  bossIcon: {
    width: 66,
    height: 66,
    borderRadius: 22,
    backgroundColor: '#65d9ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
    shadowColor: '#65d9ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 14,
  },
  bossLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.7,
  },
  bossTitle: {
    fontSize: 24,
    fontWeight: '900',
    marginTop: 7,
    textAlign: 'center',
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  bossDetail: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 8,
  },
  rewardRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 14,
    marginTop: 21,
    paddingTop: 17,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  reward: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rewardIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 178, 92, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rewardLabel: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  rewardValue: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 3,
  },
  section: {
    marginTop: 26,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 10,
  },
  progressEyebrow: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  progressTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  progressValue: {
    fontSize: 16,
    fontWeight: '900',
  },
  track: {
    height: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 8,
  },
  progressDetail: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 9,
  },
  ruleCard: {
    flexDirection: 'row',
    gap: 11,
    borderWidth: 1,
    borderRadius: 17,
    padding: 14,
    marginTop: 22,
  },
  ruleTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  ruleCopy: {
    fontSize: 11,
    lineHeight: 17,
    marginTop: 4,
  },
  lockedButtonContainer: {
    marginTop: 22,
    alignItems: 'center',
    gap: 8,
  },
  lockedButton: {
    width: '100%',
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 84, 112, 0.4)',
    backgroundColor: 'rgba(255, 84, 112, 0.12)',
  },
  lockedButtonText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#ff5470',
    letterSpacing: 1.2,
  },
  lockedButtonHelper: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.4)',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
});