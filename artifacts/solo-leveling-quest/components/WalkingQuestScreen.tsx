import React, { useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Dimensions, Platform, StatusBar, Alert,
} from 'react-native';
import Animated, {
  useSharedValue, withTiming, withRepeat,
  withSequence, useAnimatedProps, useAnimatedStyle,
  Easing, FadeIn,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

import { useWalkingQuest, TARGET_DISTANCE_M } from '../hooks/useWalkingQuest';
import { metersToKm, formatTime } from '../utils/haversine';

// ─── Design Tokens ────────────────────────────────────────────────────────────
const C = {
  bg:          '#050811',
  surface:     '#0c101d',
  surfaceCard: '#111728',
  cyan:        '#00e5ff',
  cyanLight:   '#7df3ff',
  cyanDim:     'rgba(0, 229, 255, 0.15)',
  blue:        '#0066ff',
  purple:      '#7b2cf9',
  green:       '#00e676',
  red:         '#ff2a55',
  text:        '#e1e7f5',
  muted:       '#5a6787',
  border:      'rgba(0, 229, 255, 0.25)',
};

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const RING_RADIUS        = 110;
const RING_STROKE        = 9;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const SVG_SIZE           = (RING_RADIUS + RING_STROKE) * 2 + 12;

interface ProgressRingProps {
  progress: number; // 0-1
}

const ProgressRing = ({ progress }: ProgressRingProps) => {
  const offset = useSharedValue(RING_CIRCUMFERENCE);

  useEffect(() => {
    offset.value = withTiming(
      RING_CIRCUMFERENCE * (1 - Math.min(1, Math.max(0, progress))),
      { duration: 600, easing: Easing.out(Easing.cubic) },
    );
  }, [progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: offset.value,
  }));

  return (
    <Svg width={SVG_SIZE} height={SVG_SIZE} style={styles.ring}>
      <Defs>
        <LinearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0"   stopColor={C.cyan}   stopOpacity="1" />
          <Stop offset="0.6" stopColor={C.blue}   stopOpacity="1" />
          <Stop offset="1"   stopColor={C.purple} stopOpacity="0.8" />
        </LinearGradient>
      </Defs>

      {/* Background track */}
      <Circle
        cx={SVG_SIZE / 2}
        cy={SVG_SIZE / 2}
        r={RING_RADIUS}
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={RING_STROKE}
        fill="none"
      />

      {/* Progress fill */}
      <AnimatedCircle
        cx={SVG_SIZE / 2}
        cy={SVG_SIZE / 2}
        r={RING_RADIUS}
        stroke="url(#ringGrad)"
        strokeWidth={RING_STROKE}
        fill="none"
        strokeDasharray={RING_CIRCUMFERENCE}
        animatedProps={animatedProps}
        strokeLinecap="round"
        rotation="-90"
        origin={`${SVG_SIZE / 2}, ${SVG_SIZE / 2}`}
      />
    </Svg>
  );
};

// ─── Pulsing GPS beacon dot ──────────────────────────────────────────────────
const GpsDot = ({ active }: { active: boolean }) => {
  const scale   = useSharedValue(1);
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    if (active) {
      scale.value = withRepeat(
        withSequence(withTiming(1.6, { duration: 600 }), withTiming(1, { duration: 600 })),
        -1, true,
      );
      opacity.value = withRepeat(
        withSequence(withTiming(1, { duration: 600 }), withTiming(0.4, { duration: 600 })),
        -1, true,
      );
    } else {
      scale.value   = withTiming(1);
      opacity.value = withTiming(0.4);
    }
  }, [active]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
    backgroundColor: active ? C.green : C.muted,
  }));

  return <Animated.View style={[styles.gpsDot, style]} />;
};

const MILESTONES = [1000, 2000];

// ─── Completion Overlay ──────────────────────────────────────────────────────
const CompletionOverlay = ({ elapsedSec, onClose }: { elapsedSec: number; onClose: () => void }) => (
  <Animated.View entering={FadeIn.duration(500)} style={styles.completionOverlay}>
    <View style={styles.completionBadge}>
      <MaterialCommunityIcons name="trophy-award" size={48} color={C.cyan} />
    </View>

    <Text style={styles.completionEyebrow}>SYSTEM // OBJECTIVE COMPLETE</Text>
    <Text style={styles.completionTitle}>3.00 KM CLEARED</Text>

    <View style={{ alignItems: 'center', gap: 10, width: '100%' }}>
      <View style={styles.systemBox}>
        <Text style={styles.systemText}>[System] You have traversed 3.00 km of the physical gate.</Text>
      </View>
      <View style={[styles.systemBox, { borderColor: C.green }]}>
        <Text style={[styles.systemText, { color: C.green, fontWeight: '700' }]}>
          [REWARD] +150 XP · +2 STAMINA · +1 DISCIPLINE
        </Text>
      </View>
      <Text style={styles.completionTime}>Completion Time: {formatTime(elapsedSec)}</Text>
    </View>

    <TouchableOpacity style={styles.claimBtn} onPress={onClose} activeOpacity={0.85}>
      <Text style={styles.claimBtnText}>CLAIM REWARD</Text>
    </TouchableOpacity>
  </Animated.View>
);

// ─── Main Walking Quest Screen ────────────────────────────────────────────────
interface WalkingQuestScreenProps {
  onComplete: (xpGained: number) => void;
  onBack:     () => void;
}

export const WalkingQuestScreen = ({ onComplete, onBack }: WalkingQuestScreenProps) => {
  const milestonesHit = useRef(new Set<number>());

  const handleComplete = useCallback(async (_distanceM: number, _elapsedSec: number) => {
    if (Platform.OS !== 'web') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, []);

  const { state, startWalk, startSimulation, pauseWalk, resumeWalk, stopWalk } = useWalkingQuest({
    onComplete: handleComplete,
  });

  // Milestone haptic bursts at 1 km and 2 km
  useEffect(() => {
    for (const milestone of MILESTONES) {
      if (state.distanceM >= milestone && !milestonesHit.current.has(milestone)) {
        milestonesHit.current.add(milestone);
        if (Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        }
      }
    }
  }, [state.distanceM]);

  const confirmStop = useCallback(() => {
    Alert.alert(
      'Abort Walking Protocol?',
      'Your recorded distance will be lost and the quest will reset.',
      [
        { text: 'Keep Walking', style: 'cancel' },
        { text: 'Abort', style: 'destructive', onPress: stopWalk },
      ],
    );
  }, [stopWalk]);

  const isActive  = state.status === 'active';
  const isPaused  = state.status === 'paused';
  const isDone    = state.status === 'completed';
  const isRunning = isActive || isPaused;

  const progressFraction = state.distanceM / TARGET_DISTANCE_M;

  const statusLabel =
    state.status === 'idle'                  ? '[System] Quest ready. Begin walking.' :
    state.status === 'requesting_permission' ? '[System] Calibrating GPS sensors...' :
    state.status === 'permission_denied'     ? '[System] Error: Location permission required.' :
    state.status === 'active'               ? (state.isSimulating ? '[System] Fast Simulator Active...' : '[System] Recording movement sensor...') :
    state.status === 'paused'               ? '[System] Walk paused. Sensors standby.' :
    '[System] Quest cleared.';

  const statusColor =
    state.status === 'permission_denied' ? C.red :
    state.status === 'paused'            ? C.muted :
    C.cyanLight;

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} disabled={isRunning}>
          <Text style={[styles.backText, isRunning && { opacity: 0.3 }]}>
            <Feather name="arrow-left" size={14} /> Back
          </Text>
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerEyebrow}>DAILY QUEST</Text>
          <Text style={styles.headerTitle}>3 KM WALKING PROTOCOL</Text>
        </View>
        <View style={styles.gpsIndicator}>
          <GpsDot active={isActive} />
          <Text style={styles.gpsLabel}>GPS</Text>
        </View>
      </View>

      {/* System Status Box */}
      <View style={styles.statusRow}>
        <View style={styles.systemBox}>
          <Text style={[styles.systemText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
      </View>

      {/* Animated Circular Progress Ring + Telemetry */}
      <View style={styles.ringContainer}>
        <ProgressRing progress={progressFraction} />

        <View style={styles.ringCenter}>
          <Text style={styles.distanceValue}>{metersToKm(state.distanceM)}</Text>
          <Text style={styles.distanceUnit}>KM</Text>
          <Text style={styles.distanceTarget}>/ 3.00 KM</Text>

          <View style={styles.pctBadge}>
            <Text style={styles.pctText}>{Math.floor(state.progressPct)}%</Text>
          </View>
        </View>
      </View>

      {/* Live Telemetry Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCell}>
          <Text style={styles.statValue}>{state.speedKmh}</Text>
          <Text style={styles.statLabel}>KM/H</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCell}>
          <Text style={styles.statValue}>{formatTime(state.elapsedSec)}</Text>
          <Text style={styles.statLabel}>ELAPSED</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCell}>
          <Text style={styles.statValue}>
            {metersToKm(Math.max(0, TARGET_DISTANCE_M - state.distanceM))}
          </Text>
          <Text style={styles.statLabel}>REMAINING</Text>
        </View>
      </View>

      {/* Milestone Track (1km, 2km, 3km) */}
      <View style={styles.milestoneRow}>
        {[1000, 2000, 3000].map((m) => {
          const reached = state.distanceM >= m;
          return (
            <View key={m} style={styles.milestoneItem}>
              <View style={[styles.milestoneDot, reached && styles.milestoneDotDone]} />
              <Text style={[styles.milestoneLabel, reached && { color: C.cyan }]}>
                {m / 1000} KM
              </Text>
            </View>
          );
        })}
        <View style={styles.milestoneLine} />
        <View
          style={[
            styles.milestoneLine,
            styles.milestoneLineFill,
            { width: `${Math.min(100, progressFraction * 100)}%` },
          ]}
        />
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        {state.status === 'idle' || state.status === 'permission_denied' ? (
          <View style={{ gap: 10 }}>
            <TouchableOpacity style={styles.startBtn} onPress={startWalk} activeOpacity={0.85}>
              <Text style={styles.startBtnText}>START SENSOR WALK</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.simBtn} onPress={startSimulation} activeOpacity={0.8}>
              <Text style={styles.simBtnText}>⚡ FAST SIMULATOR (TEST)</Text>
            </TouchableOpacity>
          </View>
        ) : isActive ? (
          <View style={styles.activeControls}>
            <TouchableOpacity style={styles.pauseBtn} onPress={pauseWalk} activeOpacity={0.85}>
              <Text style={styles.pauseBtnText}>PAUSE</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.stopBtn} onPress={confirmStop} activeOpacity={0.85}>
              <Text style={styles.stopBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
        ) : isPaused ? (
          <View style={styles.activeControls}>
            <TouchableOpacity style={styles.startBtn} onPress={resumeWalk} activeOpacity={0.85}>
              <Text style={styles.startBtnText}>RESUME</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.stopBtn} onPress={confirmStop} activeOpacity={0.85}>
              <Text style={styles.stopBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      {/* Reward Hint */}
      {!isDone && (
        <View style={styles.rewardHint}>
          <Text style={styles.rewardText}>REWARD: +150 XP · +2 STAMINA · +1 DISCIPLINE</Text>
        </View>
      )}

      {/* Completion Modal */}
      {isDone && (
        <CompletionOverlay
          elapsedSec={state.elapsedSec}
          onClose={() => onComplete(150)}
        />
      )}
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.bg,
    paddingTop: Platform.OS === 'ios' ? 56 : 28,
  },
  header: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  backBtn: { padding: 6 },
  backText: { color: C.muted, fontSize: 13, fontWeight: '600' },
  headerTitleContainer: { alignItems: 'center' },
  headerEyebrow: { fontSize: 9, letterSpacing: 2, color: C.cyan, fontWeight: '800' },
  headerTitle: { fontSize: 12, letterSpacing: 3, color: C.text, fontWeight: '800', marginTop: 2 },
  gpsIndicator: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  gpsLabel: { fontSize: 10, color: C.muted, letterSpacing: 1, fontWeight: '700' },
  gpsDot: { width: 8, height: 8, borderRadius: 4 },

  statusRow: { paddingHorizontal: 20, marginBottom: 20 },
  systemBox: {
    borderWidth: 1, borderColor: C.border,
    backgroundColor: 'rgba(12, 16, 29, 0.95)',
    paddingVertical: 12, paddingHorizontal: 14,
    borderRadius: 8,
  },
  systemText: {
    fontSize: 12, color: C.cyanLight, lineHeight: 18,
    letterSpacing: 0.5,
  },

  ringContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  ring: { position: 'absolute' },
  ringCenter: {
    width:  SVG_SIZE,
    height: SVG_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  distanceValue: {
    fontSize: 50, fontWeight: '800',
    color: '#ffffff',
    lineHeight: 54,
    letterSpacing: 1,
  },
  distanceUnit:   { fontSize: 14, color: C.cyan, letterSpacing: 2, fontWeight: '800' },
  distanceTarget: { fontSize: 12, color: C.muted, marginTop: 4, letterSpacing: 1 },
  pctBadge: {
    marginTop: 8,
    borderWidth: 1, borderColor: C.border,
    backgroundColor: C.cyanDim,
    paddingVertical: 2, paddingHorizontal: 10,
    borderRadius: 12,
  },
  pctText: { fontSize: 11, color: C.cyan, letterSpacing: 1, fontWeight: '700' },

  statsRow: {
    flexDirection:  'row',
    justifyContent: 'center',
    marginHorizontal: 20,
    marginBottom: 24,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    backgroundColor: C.surface,
    paddingVertical: 14,
  },
  statCell:    { flex: 1, alignItems: 'center' },
  statValue:   { fontSize: 18, fontWeight: '700', color: C.text, marginBottom: 2 },
  statLabel:   { fontSize: 9, color: C.muted, letterSpacing: 1, fontWeight: '600' },
  statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.07)', marginVertical: 4 },

  milestoneRow: {
    marginHorizontal: 28, marginBottom: 28,
    height: 32, position: 'relative',
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
  },
  milestoneLine: {
    position: 'absolute', left: 0, right: 0, top: 9,
    height: 2, backgroundColor: 'rgba(255,255,255,0.08)',
  },
  milestoneLineFill: {
    backgroundColor: C.cyan,
    right: undefined,
  },
  milestoneItem: { alignItems: 'center', gap: 6, zIndex: 1 },
  milestoneDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: C.muted, borderWidth: 1, borderColor: C.muted,
  },
  milestoneDotDone: { backgroundColor: C.cyan, borderColor: C.cyan },
  milestoneLabel:   { fontSize: 9, color: C.muted, letterSpacing: 0.5, fontWeight: '600' },

  controls: { paddingHorizontal: 20, marginBottom: 14 },
  startBtn: {
    backgroundColor: C.cyan,
    paddingVertical: 16, borderRadius: 10,
    alignItems: 'center',
    shadowColor: C.cyan, shadowRadius: 10, shadowOpacity: 0.4, shadowOffset: { width: 0, height: 0 },
  },
  startBtnText: {
    color: '#000000', fontSize: 13,
    letterSpacing: 2, fontWeight: '800',
  },
  simBtn: {
    borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 12, borderRadius: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  simBtnText: {
    color: C.muted, fontSize: 11,
    letterSpacing: 1, fontWeight: '700',
  },
  activeControls: { flexDirection: 'row', gap: 12 },
  pauseBtn: {
    flex: 1, borderWidth: 1, borderColor: C.cyan,
    backgroundColor: C.cyanDim,
    paddingVertical: 16, borderRadius: 10, alignItems: 'center',
  },
  pauseBtnText: { color: C.cyan, fontSize: 13, letterSpacing: 2, fontWeight: '800' },
  stopBtn: {
    width: 56, borderWidth: 1, borderColor: C.red,
    backgroundColor: 'rgba(255, 42, 85, 0.12)',
    paddingVertical: 16, borderRadius: 10, alignItems: 'center',
  },
  stopBtnText: { color: C.red, fontSize: 16, fontWeight: '800' },

  rewardHint: { alignItems: 'center', paddingHorizontal: 20 },
  rewardText:  { fontSize: 10, color: C.muted, letterSpacing: 1, fontWeight: '700' },

  completionOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(5, 8, 17, 0.98)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 18,
    paddingHorizontal: 24,
  },
  completionBadge: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: C.cyanDim,
    borderWidth: 2, borderColor: C.cyan,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: C.cyan, shadowRadius: 20, shadowOpacity: 0.7, shadowOffset: { width: 0, height: 0 },
  },
  completionEyebrow: {
    fontSize: 10, fontWeight: '800',
    color: C.cyan, letterSpacing: 3,
  },
  completionTitle: {
    fontSize: 26, fontWeight: '800',
    color: '#ffffff', letterSpacing: 3,
  },
  completionTime:  { fontSize: 12, color: C.muted, letterSpacing: 1, marginTop: 4 },
  claimBtn: {
    marginTop: 10,
    backgroundColor: C.cyan,
    paddingVertical: 16, paddingHorizontal: 48,
    borderRadius: 10, alignItems: 'center',
    shadowColor: C.cyan, shadowRadius: 15, shadowOpacity: 0.5, shadowOffset: { width: 0, height: 0 },
  },
  claimBtnText: {
    color: '#000000', fontSize: 13, letterSpacing: 2, fontWeight: '800',
  },
});
