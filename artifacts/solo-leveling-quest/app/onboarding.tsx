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
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeInLeft,
  FadeOut,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useQuestContext } from '@/context/QuestContext';
import { useSupabaseAuth } from '@/context/SupabaseAuthProvider';
import { RankAssessmentScreen } from '@/components/RankAssessmentScreen';
import { AssessmentResult } from '@/utils/assessmentEvaluation';

// ─────────────────────────────────────────────
// Design tokens — the Solo Leveling palette
// ─────────────────────────────────────────────
const C = {
  bg: '#050508',
  surface: '#0c0c14',
  gold: '#c9a227',
  goldLight: '#e8d48a',
  goldDim: 'rgba(201,162,39,0.25)',
  purple: '#7b2cf9',
  purpleDim: 'rgba(123,44,249,0.15)',
  red: '#8b1a1a',
  text: '#c8bfa8',
  muted: '#4a4460',
  white: '#ffffff',
};

const { width: W, height: H } = Dimensions.get('window');

type Step =
  | 'AWAKENING'
  | 'NAME_ENTRY'
  | 'ASSESSMENT_PROMPT'
  | 'ASSESSMENT_RUNNING'
  | 'RANK_ASSIGNED'
  | 'STATS_REVEAL'
  | 'QUESTS_ASSIGNED';

// ─────────────────────────────────────────────
// Typewriter hook
// ─────────────────────────────────────────────
const useTypewriter = (
  text: string,
  speed: number = 32,
  startDelay: number = 0,
  active: boolean = true
) => {
  const [displayed, setDisplayed] = useState('');
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    if (!active) return;
    setDisplayed('');
    setIsDone(false);
    let index = 0;

    const delayTimer = setTimeout(() => {
      const interval = setInterval(() => {
        if (index < text.length) {
          setDisplayed(text.slice(0, index + 1));
          index++;
        } else {
          setIsDone(true);
          clearInterval(interval);
        }
      }, speed);
      return () => clearInterval(interval);
    }, startDelay);

    return () => clearTimeout(delayTimer);
  }, [text, speed, startDelay, active]);

  return { displayed, isDone };
};

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
    <Animated.View
      entering={FadeInDown.duration(350).delay(delay)}
      style={[styles.systemBox, { borderColor }]}
    >
      {children}
    </Animated.View>
  );
};

// ─────────────────────────────────────────────
// STEP 1: Awakening — typewriter System messages & glowing orb
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
  const orbScale = useSharedValue(0.8);

  const { displayed, isDone } = useTypewriter(
    MESSAGES[msgIndex],
    32,
    msgIndex === 0 ? 800 : 400
  );

  useEffect(() => {
    orbOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900 }),
        withTiming(0.2, { duration: 900 })
      ),
      -1,
      true
    );
    orbScale.value = withRepeat(
      withSequence(
        withTiming(1.1, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.8, { duration: 1800, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
  }, []);

  useEffect(() => {
    if (!isDone) return;
    if (msgIndex < MESSAGES.length - 1) {
      const t = setTimeout(() => {
        setCompletedMessages((prev) => [...prev, MESSAGES[msgIndex]]);
        setMsgIndex((i) => i + 1);
      }, 700);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
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
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 600);
    return () => clearTimeout(t);
  }, []);

  const handleConfirm = useCallback(async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError('[Error] Hunter name must be at least 2 characters.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    if (trimmed.length > 20) {
      setError('[Error] Maximum 20 characters allowed.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
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
      <Animated.View
        entering={FadeIn.duration(500)}
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
              onChangeText={(t) => { setName(t); setError(''); }}
              placeholder="Type your name..."
              placeholderTextColor={C.muted}
              maxLength={20}
              returnKeyType="done"
              onSubmitEditing={handleConfirm}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <Text style={styles.charCount}>{name.length}/20</Text>
          </View>

          {/* Animated underline */}
          <Animated.View
            entering={FadeIn.duration(600).delay(300)}
            style={styles.inputLine}
          />

          {error ? (
            <Animated.View entering={FadeInDown.duration(300)}>
              <Text style={styles.errorText}>{error}</Text>
            </Animated.View>
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
      </Animated.View>
    </KeyboardAvoidingView>
  );
};

// ─────────────────────────────────────────────
// STEP 3: Assessment Prompt Choice
// ─────────────────────────────────────────────
const AssessmentPromptStep = ({
  hunterName,
  onTakeAssessment,
  onSkipAssessment,
}: {
  hunterName: string;
  onTakeAssessment: () => void;
  onSkipAssessment: () => void;
}) => {
  const { displayed, isDone } = useTypewriter(
    `[System] Hunter ${hunterName.toUpperCase()}, physical awakening assessment is available.`,
    28,
    300
  );

  return (
    <ScrollView contentContainerStyle={styles.assessmentPromptScroll} showsVerticalScrollIndicator={false}>
      <SystemBox>
        <Text style={styles.systemText}>
          {displayed}
          {!isDone && <Text style={styles.cursor}> |</Text>}
        </Text>
      </SystemBox>

      <Animated.View entering={FadeInUp.duration(500).delay(400)} style={styles.assessmentCard}>
        <Text style={styles.assessmentTitle}>AI VISION RANK CALIBRATION</Text>
        <Text style={styles.assessmentDesc}>
          Test your physical limits through AI-monitored Push-ups & Sit-ups to immediately claim your true Rank (E through S) and starting Level (1 to 50+).
        </Text>

        <View style={styles.assessmentCaution}>
          <Text style={styles.cautionTitle}>⚠️ SYSTEM NOTICE</Text>
          <Text style={styles.cautionDesc}>
            If you skip, you will be assigned default E-Rank (Level 1). You may undertake the official assessment later from your Profile page, but only once.
          </Text>
        </View>

        <View style={styles.promptActions}>
          <TouchableOpacity
            style={styles.commenceBtn}
            onPress={async () => {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              onTakeAssessment();
            }}
            activeOpacity={0.85}
          >
            <Text style={styles.commenceBtnText}>START AI RANK ASSESSMENT</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.skipPromptBtn}
            onPress={async () => {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onSkipAssessment();
            }}
            activeOpacity={0.75}
          >
            <Text style={styles.skipPromptBtnText}>SKIP FOR NOW (ASSIGN E-RANK)</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </ScrollView>
  );
};

// ─────────────────────────────────────────────
// STEP 4: Rank assigned reveal
// ─────────────────────────────────────────────
const RankAssignedStep = ({
  hunterName,
  rank,
  level,
  title,
  onNext,
}: {
  hunterName: string;
  rank: 'E' | 'D' | 'C' | 'B' | 'A' | 'S';
  level: number;
  title: string;
  onNext: () => void;
}) => {
  const [showRank, setShowRank] = useState(false);
  const rankScale = useSharedValue(0);
  const rankGlow = useSharedValue(0);

  const { displayed, isDone } = useTypewriter(
    `[System] ${hunterName.toUpperCase()}, your rank has been verified.`,
    28,
    400
  );

  const getRankColor = (r: string) => {
    switch (r) {
      case 'S': return '#b693ff';
      case 'A': return '#ffb25c';
      case 'B': return '#00e5ff';
      case 'C': return '#75e2b6';
      case 'D': return '#5599e2';
      default: return '#c9a227';
    }
  };

  const getRankQuote = (r: string) => {
    switch (r) {
      case 'S': return '"The Monarch has awakened."';
      case 'A': return '"High-Rank Vanguard classification granted."';
      case 'B': return '"Elite Strike Force capabilities verified."';
      case 'C': return '"Dungeon Striker certification complete."';
      case 'D': return '"Awakened potential unlocked."';
      default: return '"Every S-Rank began exactly here."';
    }
  };

  useEffect(() => {
    if (!isDone) return;
    const t = setTimeout(async () => {
      setShowRank(true);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      rankScale.value = withSpring(1, { damping: 9, stiffness: 80 });
      rankGlow.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1200 }),
          withTiming(0.3, { duration: 1200 })
        ),
        -1,
        true
      );
    }, 500);
    return () => clearTimeout(t);
  }, [isDone]);

  useEffect(() => {
    if (!showRank) return;
    const t = setTimeout(onNext, 3400);
    return () => clearTimeout(t);
  }, [showRank, onNext]);

  const rankStyle = useAnimatedStyle(() => ({
    transform: [{ scale: rankScale.value }],
    shadowOpacity: rankGlow.value,
  }));

  const rankColor = getRankColor(rank);

  return (
    <View style={styles.stepContainer}>
      <SystemBox>
        <Text style={styles.systemText}>
          {displayed}
          {!isDone && <Text style={styles.cursor}> |</Text>}
        </Text>
      </SystemBox>

      {showRank && (
        <Animated.View
          entering={FadeIn.duration(500).delay(200)}
          style={{ alignItems: 'center', marginTop: 36 }}
        >
          <Animated.View
            style={[
              styles.rankBadge,
              { borderColor: rankColor, shadowColor: rankColor },
              rankStyle,
            ]}
          >
            <Text style={[styles.rankLetter, { color: rankColor }]}>{rank}</Text>
            <Text style={[styles.rankSub, { color: rankColor }]}>RANK</Text>
          </Animated.View>

          <Animated.Text
            entering={FadeInUp.duration(600).delay(500)}
            style={styles.rankLevelText}
          >
            STARTING LEVEL {level} • "{title}"
          </Animated.Text>

          <Animated.Text
            entering={FadeInUp.duration(600).delay(700)}
            style={styles.rankQuote}
          >
            {getRankQuote(rank)}
          </Animated.Text>

          <Animated.Text
            entering={FadeIn.duration(400).delay(1800)}
            style={styles.autoAdvance}
          >
            Continuing to attributes...
          </Animated.Text>
        </Animated.View>
      )}
    </View>
  );
};

// ─────────────────────────────────────────────
// STEP 5: Stats reveal — animated bars
// ─────────────────────────────────────────────
const StatBar = ({
  label,
  value,
  color,
  index,
}: {
  label: string;
  value: number;
  color: string;
  index: number;
}) => {
  const barWidth = useSharedValue(0);
  const maxWidth = Math.min(W - 96 - 60, 240);

  useEffect(() => {
    barWidth.value = withDelay(
      400 + index * 220,
      withTiming((Math.min(100, Math.max(10, value * 2)) / 100) * maxWidth, {
        duration: 900,
        easing: Easing.out(Easing.cubic),
      })
    );
  }, [value, index, maxWidth]);

  const barStyle = useAnimatedStyle(() => ({ width: barWidth.value }));

  return (
    <Animated.View
      entering={FadeInLeft.springify().damping(20).delay(300 + index * 220)}
      style={styles.statRow}
    >
      <Text style={[styles.statLabel, { color }]}>{label}</Text>
      <View style={styles.statBarTrack}>
        <Animated.View
          style={[styles.statBarFill, { backgroundColor: color }, barStyle]}
        />
      </View>
      <Animated.Text
        entering={FadeIn.delay(400 + index * 220 + 600)}
        style={styles.statValue}
      >
        {value}
      </Animated.Text>
    </Animated.View>
  );
};

const StatsRevealStep = ({
  stats,
  onNext,
}: {
  stats: { STR: number; INT: number; STAMINA: number; DISCIPLINE: number };
  onNext: () => void;
}) => {
  const [showButton, setShowButton] = useState(false);

  const { displayed, isDone } = useTypewriter(
    '[System] Initial stats have been allocated.',
    30,
    300
  );

  const statsList = [
    { key: 'str', label: 'STR', value: stats.STR, color: '#d64f4f' },
    { key: 'int', label: 'INT', value: stats.INT, color: '#5599e2' },
    { key: 'stamina', label: 'STA', value: stats.STAMINA, color: '#42c97a' },
    { key: 'discipline', label: 'DIS', value: stats.DISCIPLINE, color: C.gold },
  ];

  useEffect(() => {
    const delay = 400 + statsList.length * 220 + 900 + 200;
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
        {statsList.map((stat, i) => (
          <StatBar
            key={stat.key}
            label={stat.label}
            value={stat.value}
            color={stat.color}
            index={i}
          />
        ))}
      </View>

      {showButton && (
        <Animated.View entering={FadeIn.duration(400)}>
          <TouchableOpacity
            style={styles.confirmBtn}
            onPress={onNext}
            activeOpacity={0.75}
          >
            <Text style={styles.confirmBtnText}>VIEW DAILY QUESTS</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </ScrollView>
  );
};

// ─────────────────────────────────────────────
// STEP 6: Quests assigned
// ─────────────────────────────────────────────
const PRESET_QUESTS = [
  { icon: '💪', name: '100 Push-Ups', xp: 40, type: 'Strength' },
  { icon: '🔥', name: '20 Sit-Ups', xp: 40, type: 'Stamina' },
  { icon: '🏋️', name: 'Gym Regimen', xp: 55, type: 'Stamina' },
  { icon: '💻', name: 'Deep Work Coding', xp: 65, type: 'Intelligence' },
  { icon: '🧠', name: 'Chew Gum', xp: 15, type: 'Discipline' },
];

const QuestsAssignedStep = ({ onNext }: { onNext: () => void }) => {
  const [showButton, setShowButton] = useState(false);

  const { displayed: msg1, isDone: done1 } = useTypewriter(
    '[System] Daily quests have been assigned, Hunter.',
    30,
    300
  );
  const { displayed: msg2, isDone: done2 } = useTypewriter(
    '[Warning] Failure to complete all quests will invoke a penalty.',
    30,
    done1 ? 250 : 9999
  );

  useEffect(() => {
    if (!done2) return;
    const t = setTimeout(() => setShowButton(true), 400 + PRESET_QUESTS.length * 120 + 300);
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
          <SystemBox variant="warning" delay={150}>
            <Text style={[styles.systemText, { color: '#e06c75' }]}>
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
            <Animated.View
              key={q.name}
              entering={FadeInLeft.springify().damping(18).delay(80 + i * 110)}
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
            </Animated.View>
          ))}
        </View>
      )}

      {showButton && (
        <Animated.View
          entering={FadeInUp.springify().damping(18)}
          style={{ marginTop: 28, width: '100%' }}
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
        </Animated.View>
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
      Array.from({ length: 36 }, (_, i) => ({
        id: i,
        top: Math.random() * H,
        left: Math.random() * W,
        size: Math.random() * 1.8 + 0.6,
      })),
    []
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {stars.map((s) => (
        <View
          key={s.id}
          style={[
            styles.star,
            { top: s.top, left: s.left, width: s.size, height: s.size },
          ]}
        />
      ))}
    </View>
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
  const visibleStep =
    current === 'ASSESSMENT_PROMPT' || current === 'ASSESSMENT_RUNNING'
      ? 'NAME_ENTRY'
      : current;
  const idx = STEP_ORDER.indexOf(visibleStep);

  return (
    <View style={styles.progressRow}>
      {STEP_ORDER.map((s, i) => (
        <View
          key={s}
          style={[
            styles.dot,
            {
              width: i <= idx ? 20 : 6,
              backgroundColor: i <= idx ? C.gold : C.muted,
              opacity: i <= idx ? 1 : 0.4,
            },
          ]}
        />
      ))}
    </View>
  );
};

// ─────────────────────────────────────────────
// Root: OnboardingScreen Route
// ─────────────────────────────────────────────
export default function OnboardingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ replay?: string }>();
  const isReplay = params.replay === 'true';

  const { isSignedIn, isLoading: authLoading } = useSupabaseAuth();
  const {
    onboardingComplete,
    completeOnboarding,
    completeAssessment,
    loading: questLoading,
  } = useQuestContext();

  const [step, setStep] = useState<Step>('AWAKENING');
  const [hunterName, setHunterName] = useState('');
  const [assessedRank, setAssessedRank] = useState<'E' | 'D' | 'C' | 'B' | 'A' | 'S'>('E');
  const [assessedLevel, setAssessedLevel] = useState(1);
  const [assessedTitle, setAssessedTitle] = useState('E-Rank Hunter');
  const [assessedStats, setAssessedStats] = useState({
    STR: 10,
    INT: 10,
    STAMINA: 10,
    DISCIPLINE: 10,
  });

  if (authLoading || questLoading) return null;
  if (!isSignedIn && !isReplay) return <Redirect href="/(auth)/sign-in" />;
  if (onboardingComplete && !isReplay) return <Redirect href="/(tabs)" />;

  const handleNameEntry = useCallback((name: string) => {
    setHunterName(name);
    setStep('ASSESSMENT_PROMPT');
  }, []);

  const handleAssessmentResult = useCallback((res: AssessmentResult) => {
    setAssessedRank(res.rank);
    setAssessedLevel(res.level);
    setAssessedTitle(res.title);
    setAssessedStats(res.stats);
    completeAssessment({
      rank: res.rank,
      level: res.level,
      stats: res.stats,
      title: res.title,
    });
    setStep('RANK_ASSIGNED');
  }, [completeAssessment]);

  const handleSkipAssessment = useCallback(() => {
    setAssessedRank('E');
    setAssessedLevel(1);
    setAssessedTitle('E-Rank Hunter');
    setAssessedStats({ STR: 10, INT: 10, STAMINA: 10, DISCIPLINE: 10 });
    setStep('RANK_ASSIGNED');
  }, []);

  const handleComplete = (finalName: string) => {
    const chosenName = finalName || hunterName || 'HUNTER';
    completeOnboarding(chosenName);
    router.replace('/(tabs)');
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* Starfield */}
      {step !== 'ASSESSMENT_RUNNING' && <StarField />}

      {/* Progress dots */}
      {step !== 'AWAKENING' && step !== 'ASSESSMENT_RUNNING' && (
        <ProgressDots current={step} />
      )}

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
        {step === 'ASSESSMENT_PROMPT' && (
          <AssessmentPromptStep
            hunterName={hunterName}
            onTakeAssessment={() => setStep('ASSESSMENT_RUNNING')}
            onSkipAssessment={handleSkipAssessment}
          />
        )}
        {step === 'ASSESSMENT_RUNNING' && (
          <RankAssessmentScreen
            hunterName={hunterName}
            onComplete={handleAssessmentResult}
            onBack={handleSkipAssessment}
          />
        )}
        {step === 'RANK_ASSIGNED' && (
          <RankAssignedStep
            hunterName={hunterName}
            rank={assessedRank}
            level={assessedLevel}
            title={assessedTitle}
            onNext={() => setStep('STATS_REVEAL')}
          />
        )}
        {step === 'STATS_REVEAL' && (
          <StatsRevealStep
            stats={assessedStats}
            onNext={() => setStep('QUESTS_ASSIGNED')}
          />
        )}
        {step === 'QUESTS_ASSIGNED' && (
          <QuestsAssignedStep onNext={() => handleComplete(hunterName)} />
        )}
      </Animated.View>
    </View>
  );
}

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
    opacity: 0.5,
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
    borderRadius: 8,
    width: '100%',
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 4,
  },
  systemText: {
    color: C.text,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    letterSpacing: 0.5,
  },
  systemTextDone: {
    color: C.muted,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    letterSpacing: 0.5,
  },
  cursor: {
    color: C.gold,
    fontWeight: 'bold',
  },

  // Orb (Awakening step)
  orb: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: C.purple,
    shadowColor: C.purple,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 36,
    elevation: 20,
    marginBottom: 48,
  },

  // Name entry
  fieldLabel: {
    color: C.muted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  input: {
    flex: 1,
    color: C.white,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 1,
    paddingVertical: 8,
  },
  charCount: {
    color: C.muted,
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  inputLine: {
    height: 2,
    backgroundColor: C.gold,
    borderRadius: 1,
    marginTop: 4,
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  errorText: {
    color: '#e06c75',
    fontSize: 11,
    marginTop: 6,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },

  // Buttons
  confirmBtn: {
    borderWidth: 1,
    borderColor: C.gold,
    backgroundColor: C.goldDim,
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 4,
    minWidth: 200,
  },
  confirmBtnText: {
    color: C.goldLight,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  btnDisabled: {
    opacity: 0.35,
  },
  beginBtn: {
    borderWidth: 1,
    borderColor: C.gold,
    backgroundColor: C.gold,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 14,
    elevation: 8,
  },
  beginBtnText: {
    color: C.bg,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 2.5,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },

  // Assessment Prompt Step
  assessmentPromptScroll: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 70 : 48,
    paddingBottom: 40,
    gap: 16,
  },
  assessmentCard: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: 'rgba(201, 162, 39, 0.3)',
    borderRadius: 12,
    padding: 18,
    gap: 12,
  },
  assessmentTitle: {
    color: C.goldLight,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.5,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  assessmentDesc: {
    color: C.text,
    fontSize: 12,
    lineHeight: 18,
  },
  assessmentCaution: {
    backgroundColor: 'rgba(139, 26, 26, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(255, 60, 60, 0.4)',
    borderRadius: 8,
    padding: 12,
    gap: 4,
  },
  cautionTitle: {
    color: '#ff6b6b',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  cautionDesc: {
    color: '#ffc9c9',
    fontSize: 11,
    lineHeight: 16,
  },
  promptActions: {
    gap: 10,
    marginTop: 6,
  },
  commenceBtn: {
    backgroundColor: C.gold,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
  },
  commenceBtnText: {
    color: C.bg,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  skipPromptBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  skipPromptBtnText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },

  // Rank badge
  rankBadge: {
    width: 130,
    height: 130,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: C.gold,
    backgroundColor: C.surface,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 28,
    elevation: 16,
  },
  rankLetter: {
    color: C.goldLight,
    fontSize: 60,
    fontWeight: '900',
    lineHeight: 68,
    letterSpacing: -2,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  rankSub: {
    color: C.gold,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 3,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  rankLevelText: {
    color: C.white,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginTop: 18,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  rankQuote: {
    color: C.muted,
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
    letterSpacing: 0.5,
  },
  autoAdvance: {
    color: C.goldDim,
    fontSize: 10,
    letterSpacing: 1.5,
    marginTop: 18,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },

  // Stats
  statsBlock: {
    width: '100%',
    gap: 16,
    marginTop: 28,
    marginBottom: 36,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statLabel: {
    width: 38,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  statBarTrack: {
    flex: 1,
    height: 8,
    backgroundColor: C.surface,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  statBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  statValue: {
    width: 28,
    color: C.text,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },

  // Quests
  questRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: 'rgba(201,162,39,0.18)',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  questIcon: {
    fontSize: 20,
  },
  questName: {
    color: C.white,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  questType: {
    color: C.muted,
    fontSize: 10,
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    letterSpacing: 0.5,
  },
  xpBadge: {
    backgroundColor: C.goldDim,
    borderWidth: 1,
    borderColor: C.gold,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  xpText: {
    color: C.goldLight,
    fontSize: 11,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    letterSpacing: 0.5,
  },
});

