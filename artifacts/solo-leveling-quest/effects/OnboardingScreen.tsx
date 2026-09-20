import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  StatusBar,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import Animated, {
  useSharedValue,
  withTiming,
  withSpring,
  withSequence,
  withDelay,
  withRepeat,
  useAnimatedStyle,
  Easing,
  runOnJS,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { MotiView, MotiText } from 'moti';
import * as Haptics from 'expo-haptics';

import { useTypewriter } from '../hooks/useTypewriter';

// ─────────────────────────────────────────────
// Design tokens — the Solo Leveling palette
// ─────────────────────────────────────────────
const C = {
  bg:          '#050508',
  surface:     '#0c0c14',
  gold:        '#c9a227',
  goldLight:   '#e8d48a',
  goldDim:     'rgba(201,162,39,0.25)',
  purple:      '#7b2cf9',
  purpleDim:   'rgba(123,44,249,0.15)',
  red:         '#8b1a1a',
  text:        '#c8bfa8',
  muted:       '#4a4460',
  white:       '#ffffff',
};

const { width: W, height: H } = Dimensions.get('window');

type Step =
  | 'AWAKENING'
  | 'NAME_ENTRY'
  | 'RANK_ASSIGNED'
  | 'STATS_REVEAL'
  | 'QUESTS_ASSIGNED';

// ─────────────────────────────────────────────
// Shared: System notification box
// ─────────────────────────────────────────────
const SystemBox = ({
  children,
  delay = 0,
  variant = 'default',
}: {
  children: React.ReactNode;
  delay?: number;
  variant?: 'default' | 'warning' | 'success';
}) => {
  const borderColor =
    variant === 'warning' ? C.red :
    variant === 'success' ? '#1a5c2a' :
    C.gold;

  return (
    <MotiView
      from={{ opacity: 0, translateY: -8 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 350, delay }}
      style={[styles.systemBox, { borderColor }]}
    >
      {children}
    </MotiView>
  );
};

// ─────────────────────────────────────────────
// STEP 1: Awakening — typewriter System messages
// ─────────────────────────────────────────────
const AwakeningStep = ({ onNext }: { onNext: () => void }) => {
  const MESSAGES = [
    '[System] A dormant player has been detected.',
    '[System] Initiating awakening sequence...',
    '[System] You have been chosen by the System, Hunter.',
  ];

  const [msgIndex, setMsgIndex] = useState(0);
  const [completedMessages, setCompletedMessages] = useState<string[]>([]);
  const orbOpacity = useSharedValue(0.2);
  const orbScale  = useSharedValue(0.8);

  const { displayed, isDone } = useTypewriter(
    MESSAGES[msgIndex],
    32,
    msgIndex === 0 ? 1200 : 500
  );

  useEffect(() => {
    orbOpacity.value = withRepeat(
      withSequence(
        withTiming(1,   { duration: 900 }),
        withTiming(0.2, { duration: 900 })
      ),
      -1,
      true
    );
    orbScale.value = withRepeat(
      withSequence(
        withTiming(1.1, { duration: 1800, easing: Easing.inOut(Easing.sine) }),
        withTiming(0.8, { duration: 1800, easing: Easing.inOut(Easing.sine) })
      ),
      -1,
      true
    );
  }, []);

  useEffect(() => {
    if (!isDone) return;
    if (msgIndex < MESSAGES.length - 1) {
      const t = setTimeout(() => {
        setCompletedMessages(prev => [...prev, MESSAGES[msgIndex]]);
        setMsgIndex(i => i + 1);
      }, 700);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        onNext();
      }, 1400);
      return () => clearTimeout(t);
    }
  }, [isDone, msgIndex]);

  const orbStyle = useAnimatedStyle(() => ({
    opacity: orbOpacity.value,
    transform: [{ scale: orbScale.value }],
  }));

  return (
    <View style={styles.stepContainer}>
      {/* Pulsing orb */}
      <Animated.View style={[styles.orb, orbStyle]} />

      {/* Completed messages (dimmed) */}
      <View style={{ width: '100%', gap: 10, marginBottom: 10 }}>
        {completedMessages.map((msg, i) => (
          <SystemBox key={i}>
            <Text style={styles.systemTextDone}>{msg}</Text>
          </SystemBox>
        ))}

        {/* Current typewriting message */}
        {msgIndex < MESSAGES.length && (
          <SystemBox key={`active-${msgIndex}`}>
            <Text style={styles.systemText}>
              {displayed}
              <Text style={styles.cursor}> |</Text>
            </Text>
          </SystemBox>
        )}
      </View>
    </View>
  );
};

// ─────────────────────────────────────────────
// STEP 2: Name entry — Hunter designation
// ─────────────────────────────────────────────
const NameEntryStep = ({ onNext }: { onNext: (name: string) => void }) => {
  const [name, setName]     = useState('');
  const [error, setError]   = useState('');
  const inputRef            = useRef<TextInput>(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 600);
    return () => clearTimeout(t);
  }, []);

  const handleConfirm = useCallback(async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError('[Error] Hunter name must be at least 2 characters.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    if (trimmed.length > 20) {
      setError('[Error] Maximum 20 characters allowed.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onNext(trimmed);
  }, [name, onNext]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.stepContainer}
    >
      <MotiView
        from={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ type: 'timing', duration: 500 }}
        style={{ width: '100%', gap: 28 }}
      >
        <SystemBox>
          <Text style={styles.systemText}>
            [System] Enter your Hunter designation.
          </Text>
        </SystemBox>

        {/* Name input */}
        <View>
          <Text style={styles.fieldLabel}>HUNTER NAME</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              ref={inputRef}
              style={styles.input}
              value={name}
              onChangeText={t => { setName(t); setError(''); }}
              placeholder="Type your name..."
              placeholderTextColor={C.muted}
              maxLength={20}
              returnKeyType="done"
              onSubmitEditing={handleConfirm}
              autoCorrect={false}
            />
            <Text style={styles.charCount}>{name.length}/20</Text>
          </View>

          {/* Animated underline */}
          <MotiView
            from={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ type: 'timing', duration: 600, delay: 400 }}
            style={styles.inputLine}
          />

          {error ? (
            <MotiView
              from={{ opacity: 0, translateY: -4 }}
              animate={{ opacity: 1, translateY: 0 }}
            >
              <Text style={styles.errorText}>{error}</Text>
            </MotiView>
          ) : null}
        </View>

        <TouchableOpacity
          style={[styles.confirmBtn, !name.trim() && styles.btnDisabled]}
          onPress={handleConfirm}
          activeOpacity={0.75}
          disabled={!name.trim()}
        >
          <Text style={styles.confirmBtnText}>CONFIRM IDENTITY</Text>
        </TouchableOpacity>
      </MotiView>
    </KeyboardAvoidingView>
  );
};

// ─────────────────────────────────────────────
// STEP 3: Rank assigned — E-Rank reveal
// ─────────────────────────────────────────────
const RankAssignedStep = ({
  hunterName,
  onNext,
}: {
  hunterName: string;
  onNext: () => void;
}) => {
  const [showRank, setShowRank] = useState(false);
  const rankScale   = useSharedValue(0);
  const rankGlow    = useSharedValue(0);

  const { displayed, isDone } = useTypewriter(
    `[System] ${hunterName.toUpperCase()}, your rank has been assessed.`,
    28,
    600
  );

  useEffect(() => {
    if (!isDone) return;
    const t = setTimeout(async () => {
      setShowRank(true);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      rankScale.value = withSpring(1, { damping: 9, stiffness: 80 });
      rankGlow.value  = withRepeat(
        withSequence(
          withTiming(1,   { duration: 1200 }),
          withTiming(0.3, { duration: 1200 })
        ),
        -1,
        true
      );
    }, 600);
    return () => clearTimeout(t);
  }, [isDone]);

  useEffect(() => {
    if (!showRank) return;
    const t = setTimeout(onNext, 3000);
    return () => clearTimeout(t);
  }, [showRank, onNext]);

  const rankStyle = useAnimatedStyle(() => ({
    transform: [{ scale: rankScale.value }],
    shadowOpacity: rankGlow.value,
  }));

  return (
    <View style={styles.stepContainer}>
      <SystemBox>
        <Text style={styles.systemText}>
          {displayed}
          {!isDone && <Text style={styles.cursor}> |</Text>}
        </Text>
      </SystemBox>

      {showRank && (
        <MotiView
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ type: 'timing', duration: 500, delay: 200 }}
          style={{ alignItems: 'center', marginTop: 48 }}
        >
          <Animated.View style={[styles.rankBadge, rankStyle]}>
            <Text style={styles.rankLetter}>E</Text>
            <Text style={styles.rankSub}>RANK</Text>
          </Animated.View>

          <MotiText
            from={{ opacity: 0, translateY: 12 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 600, delay: 800 }}
            style={styles.rankQuote}
          >
            "Every S-Rank began exactly here."
          </MotiText>

          {/* Subtle auto-advance hint */}
          <MotiText
            from={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ type: 'timing', duration: 400, delay: 2000 }}
            style={styles.autoAdvance}
          >
            Continuing...
          </MotiText>
        </MotiView>
      )}
    </View>
  );
};

// ─────────────────────────────────────────────
// STEP 4: Stats reveal — animated bars
// ─────────────────────────────────────────────
const STATS = [
  { key: 'str',       label: 'STR',  full: 'Strength',     value: 10, color: '#d64f4f' },
  { key: 'int',       label: 'INT',  full: 'Intelligence', value: 10, color: '#5599e2' },
  { key: 'stamina',   label: 'STA',  full: 'Stamina',      value: 10, color: '#42c97a' },
  { key: 'discipline',label: 'DIS',  full: 'Discipline',   value: 10, color: C.gold },
] as const;

// Individual stat bar extracted so hooks are not called inside map()
const StatBar = ({
  stat,
  index,
}: {
  stat: (typeof STATS)[number];
  index: number;
}) => {
  const barWidth = useSharedValue(0);
  const maxWidth = W - 96 - 60; // padding + label + value widths

  useEffect(() => {
    barWidth.value = withDelay(
      500 + index * 280,
      withTiming((stat.value / 100) * maxWidth, {
        duration: 900,
        easing: Easing.out(Easing.cubic),
      })
    );
  }, []);

  const barStyle = useAnimatedStyle(() => ({ width: barWidth.value }));

  return (
    <MotiView
      from={{ opacity: 0, translateX: -24 }}
      animate={{ opacity: 1, translateX: 0 }}
      transition={{ type: 'spring', damping: 22, delay: 400 + index * 280 }}
      style={styles.statRow}
    >
      <Text style={[styles.statLabel, { color: stat.color }]}>{stat.label}</Text>
      <View style={styles.statBarTrack}>
        <Animated.View
          style={[styles.statBarFill, { backgroundColor: stat.color }, barStyle]}
        />
      </View>
      <MotiText
        from={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 500 + index * 280 + 800 }}
        style={styles.statValue}
      >
        {stat.value}
      </MotiText>
    </MotiView>
  );
};

const StatsRevealStep = ({ onNext }: { onNext: () => void }) => {
  const [showButton, setShowButton] = useState(false);

  const { displayed, isDone } = useTypewriter(
    '[System] Initial stats have been assigned.',
    30,
    400
  );

  useEffect(() => {
    const delay = 500 + STATS.length * 280 + 900 + 300;
    const t = setTimeout(() => setShowButton(true), delay);
    return () => clearTimeout(t);
  }, []);

  return (
    <ScrollView
      contentContainerStyle={[styles.stepContainer, { paddingBottom: 40 }]}
      showsVerticalScrollIndicator={false}
    >
      <SystemBox>
        <Text style={styles.systemText}>
          {displayed}
          {!isDone && <Text style={styles.cursor}> |</Text>}
        </Text>
      </SystemBox>

      <View style={styles.statsBlock}>
        {STATS.map((stat, i) => (
          <StatBar key={stat.key} stat={stat} index={i} />
        ))}
      </View>

      {showButton && (
        <MotiView
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ type: 'timing', duration: 500 }}
        >
          <TouchableOpacity
            style={styles.confirmBtn}
            onPress={onNext}
            activeOpacity={0.75}
          >
            <Text style={styles.confirmBtnText}>VIEW DAILY QUESTS</Text>
          </TouchableOpacity>
        </MotiView>
      )}
    </ScrollView>
  );
};

// ─────────────────────────────────────────────
// STEP 5: Quests assigned
// ─────────────────────────────────────────────
const PRESET_QUESTS = [
  { icon: '💪', name: '100 Push-Ups',    xp: 50, type: 'Physical' },
  { icon: '🔥', name: '100 Sit-Ups',     xp: 50, type: 'Physical' },
  { icon: '🏋️', name: 'Gym Regimen',     xp: 80, type: 'Physical' },
  { icon: '💻', name: '1 Hour Coding',   xp: 60, type: 'Mental'   },
  { icon: '🧠', name: 'Chewing Gum',     xp: 20, type: 'Habit'    },
];

const QuestsAssignedStep = ({ onNext }: { onNext: () => void }) => {
  const [showButton, setShowButton] = useState(false);

  const { displayed: msg1, isDone: done1 } = useTypewriter(
    '[System] Daily quests have been assigned, Hunter.',
    30,
    400
  );
  const { displayed: msg2, isDone: done2 } = useTypewriter(
    '[Warning] Failure to complete all quests will invoke a penalty.',
    30,
    done1 ? 300 : 9999
  );

  useEffect(() => {
    if (!done2) return;
    const t = setTimeout(() => setShowButton(true), 600 + PRESET_QUESTS.length * 150 + 400);
    return () => clearTimeout(t);
  }, [done2]);

  return (
    <ScrollView
      contentContainerStyle={[styles.stepContainer, { paddingBottom: 48 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ width: '100%', gap: 10, marginBottom: 24 }}>
        <SystemBox>
          <Text style={styles.systemText}>
            {msg1}
            {!done1 && <Text style={styles.cursor}> |</Text>}
          </Text>
        </SystemBox>

        {done1 && (
          <SystemBox variant="warning" delay={200}>
            <Text style={[styles.systemText, { color: '#c46464' }]}>
              {msg2}
              {!done2 && <Text style={styles.cursor}> |</Text>}
            </Text>
          </SystemBox>
        )}
      </View>

      {/* Quest list */}
      {done2 && (
        <View style={{ width: '100%', gap: 8 }}>
          {PRESET_QUESTS.map((q, i) => (
            <MotiView
              key={q.name}
              from={{ opacity: 0, translateX: -32 }}
              animate={{ opacity: 1, translateX: 0 }}
              transition={{ type: 'spring', damping: 18, delay: 100 + i * 140 }}
              style={styles.questRow}
            >
              <Text style={styles.questIcon}>{q.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.questName}>{q.name}</Text>
                <Text style={styles.questType}>{q.type}</Text>
              </View>
              <View style={styles.xpBadge}>
                <Text style={styles.xpText}>+{q.xp} XP</Text>
              </View>
            </MotiView>
          ))}
        </View>
      )}

      {showButton && (
        <MotiView
          from={{ opacity: 0, translateY: 12 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'spring', damping: 18 }}
          style={{ marginTop: 32, width: '100%' }}
        >
          <TouchableOpacity
            style={styles.beginBtn}
            onPress={async () => {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              onNext();
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.beginBtnText}>BEGIN YOUR JOURNEY</Text>
          </TouchableOpacity>
        </MotiView>
      )}
    </ScrollView>
  );
};

// ─────────────────────────────────────────────
// Animated star field background
// ─────────────────────────────────────────────
const StarField = () => {
  const stars = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        id: i,
        top:      Math.random() * H,
        left:     Math.random() * W,
        size:     Math.random() * 1.8 + 0.6,
        delay:    Math.random() * 3000,
        duration: 2200 + Math.random() * 3000,
      })),
    []
  );

  return (
    <>
      {stars.map(s => (
        <MotiView
          key={s.id}
          style={[
            styles.star,
            { top: s.top, left: s.left, width: s.size, height: s.size },
          ]}
          from={{ opacity: 0 }}
          animate={{ opacity: [0, 0.75, 0] }}
          transition={{
            loop: true,
            duration: s.duration,
            delay: s.delay,
            type: 'timing',
          }}
        />
      ))}
    </>
  );
};

// ─────────────────────────────────────────────
// Step progress indicator
// ─────────────────────────────────────────────
const STEP_ORDER: Step[] = [
  'AWAKENING',
  'NAME_ENTRY',
  'RANK_ASSIGNED',
  'STATS_REVEAL',
  'QUESTS_ASSIGNED',
];

const ProgressDots = ({ current }: { current: Step }) => {
  const idx = STEP_ORDER.indexOf(current);
  return (
    <View style={styles.progressRow}>
      {STEP_ORDER.map((_, i) => (
        <MotiView
          key={i}
          animate={{
            width:           i <= idx ? 20 : 6,
            backgroundColor: i <= idx ? C.gold : C.muted,
            opacity:         i <= idx ? 1 : 0.4,
          }}
          transition={{ type: 'spring', damping: 20 }}
          style={styles.dot}
        />
      ))}
    </View>
  );
};

// ─────────────────────────────────────────────
// Root: OnboardingScreen
// ─────────────────────────────────────────────
interface OnboardingScreenProps {
  /** Called when the user finishes onboarding. Receives the hunter name. */
  onComplete: (hunterName: string) => void;
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onComplete }) => {
  const [step, setStep]           = useState<Step>('AWAKENING');
  const [hunterName, setHunterName] = useState('');

  const handleNameEntry = useCallback((name: string) => {
    setHunterName(name);
    setStep('RANK_ASSIGNED');
  }, []);

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* Starfield — persistent across steps */}
      <StarField />

      {/* Progress dots */}
      {step !== 'AWAKENING' && <ProgressDots current={step} />}

      {/* Step content with cross-fade */}
      <Animated.View
        key={step}
        entering={FadeIn.duration(400)}
        exiting={FadeOut.duration(250)}
        style={StyleSheet.absoluteFill}
      >
        {step === 'AWAKENING' && (
          <AwakeningStep onNext={() => setStep('NAME_ENTRY')} />
        )}
        {step === 'NAME_ENTRY' && (
          <NameEntryStep onNext={handleNameEntry} />
        )}
        {step === 'RANK_ASSIGNED' && (
          <RankAssignedStep
            hunterName={hunterName}
            onNext={() => setStep('STATS_REVEAL')}
          />
        )}
        {step === 'STATS_REVEAL' && (
          <StatsRevealStep onNext={() => setStep('QUESTS_ASSIGNED')} />
        )}
        {step === 'QUESTS_ASSIGNED' && (
          <QuestsAssignedStep onNext={() => onComplete(hunterName)} />
        )}
      </Animated.View>
    </View>
  );
};

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.bg,
  },
  stepContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
  },

  // Star field
  star: {
    position: 'absolute',
    borderRadius: 2,
    backgroundColor: C.white,
  },

  // Progress dots
  progressRow: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 24,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    zIndex: 10,
  },
  dot: {
    height: 4,
    borderRadius: 4,
  },

  // System box
  systemBox: {
    borderWidth: 1,
    borderColor: C.gold,
    backgroundColor: 'rgba(8, 8, 16, 0.96)',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 3,
    width: '100%',
  },
  systemText: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontSize: 14,
    color: C.goldLight,
    lineHeight: 22,
    letterSpacing: 0.4,
  },
  systemTextDone: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontSize: 14,
    color: C.muted,
    lineHeight: 22,
  },
  cursor: {
    color: C.gold,
  },

  // Awakening orb
  orb: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: C.purpleDim,
    borderWidth: 1.5,
    borderColor: C.purple,
    marginBottom: 52,
    shadowColor: C.purple,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 24,
    elevation: 16,
  },

  // Name entry
  fieldLabel: {
    fontSize: 9,
    letterSpacing: 3,
    color: C.muted,
    marginBottom: 10,
    fontWeight: '600',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    color: C.goldLight,
    fontSize: 22,
    paddingVertical: 8,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    letterSpacing: 1.5,
  },
  charCount: {
    color: C.muted,
    fontSize: 11,
    marginLeft: 8,
  },
  inputLine: {
    height: 1,
    backgroundColor: C.gold,
    marginTop: 4,
    transformOrigin: 'left',
  },
  errorText: {
    color: '#c46464',
    fontSize: 12,
    marginTop: 10,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  confirmBtn: {
    borderWidth: 1,
    borderColor: C.gold,
    paddingVertical: 14,
    paddingHorizontal: 36,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  btnDisabled: {
    borderColor: C.muted,
    opacity: 0.4,
  },
  confirmBtnText: {
    color: C.gold,
    fontSize: 11,
    letterSpacing: 3.5,
    fontWeight: '700',
  },

  // Rank
  rankBadge: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2.5,
    borderColor: C.gold,
    backgroundColor: '#0d0a01',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 28,
    elevation: 18,
  },
  rankLetter: {
    fontSize: 62,
    fontWeight: '700',
    color: C.gold,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    lineHeight: 70,
  },
  rankSub: {
    fontSize: 9,
    letterSpacing: 4,
    color: C.muted,
  },
  rankQuote: {
    color: C.text,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 24,
    fontStyle: 'italic',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    maxWidth: 220,
  },
  autoAdvance: {
    color: C.muted,
    fontSize: 11,
    letterSpacing: 2,
    marginTop: 36,
  },

  // Stats
  statsBlock: {
    width: '100%',
    marginTop: 32,
    marginBottom: 32,
    gap: 22,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    width: 32,
  },
  statBarTrack: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  statBarFill: {
    height: 3,
    borderRadius: 2,
  },
  statValue: {
    color: C.text,
    fontSize: 13,
    fontWeight: '600',
    width: 28,
    textAlign: 'right',
  },

  // Quests
  questRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.goldDim,
    backgroundColor: 'rgba(201,162,39,0.04)',
    borderRadius: 3,
    paddingVertical: 13,
    paddingHorizontal: 14,
    gap: 12,
    width: '100%',
  },
  questIcon: {
    fontSize: 19,
  },
  questName: {
    color: C.text,
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  questType: {
    color: C.muted,
    fontSize: 10,
    letterSpacing: 1,
    marginTop: 2,
  },
  xpBadge: {
    borderWidth: 1,
    borderColor: C.goldDim,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 2,
  },
  xpText: {
    color: C.gold,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
  },

  // Begin button
  beginBtn: {
    backgroundColor: C.gold,
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 2,
    width: '100%',
  },
  beginBtnText: {
    color: '#050508',
    fontSize: 12,
    letterSpacing: 4,
    fontWeight: '800',
  },
});
