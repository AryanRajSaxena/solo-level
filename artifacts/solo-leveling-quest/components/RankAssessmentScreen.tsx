import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
  Alert,
  Dimensions,
  ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import {
  PoseEvaluator,
  ExerciseType,
  ExerciseState,
  POSE_CONNECTIONS,
  Landmark,
} from '@/utils/poseDetection';
import {
  evaluateHunterAssessment,
  AssessmentResult,
} from '@/utils/assessmentEvaluation';
import { alarmAudio } from '@/utils/alarmAudio';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface RankAssessmentScreenProps {
  hunterName: string;
  onComplete: (result: AssessmentResult) => void;
  onBack: () => void;
}

type AssessmentStage = 'BRIEFING' | 'PUSHUPS' | 'SITUPS' | 'EVALUATING' | 'RESULT';

export const RankAssessmentScreen = ({
  hunterName,
  onComplete,
  onBack,
}: RankAssessmentScreenProps) => {
  const [stage, setStage] = useState<AssessmentStage>('BRIEFING');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  // Rep tallies
  const [pushupReps, setPushupReps] = useState(0);
  const [situpReps, setSitupReps] = useState(0);
  const [result, setResult] = useState<AssessmentResult | null>(null);

  // 60-second trial countdown
  const [timeLeft, setTimeLeft] = useState(60);

  // Active exercise evaluator
  const [exerciseState, setExerciseState] = useState<ExerciseState>({
    exercise: 'pushups',
    reps: 0,
    targetReps: 100,
    stage: 'CALIBRATING',
    angle: 0,
    rawAngle: 0,
    formFeedback: 'Initializing System Visual Sensors...',
    isGoodForm: true,
    formIssues: [],
    leftConfidence: 0,
    rightConfidence: 0,
    activeSide: 'left',
    repQuality: null,
    consecutiveGoodForm: 0,
  });

  const evaluatorRef = useRef<PoseEvaluator>(new PoseEvaluator('pushups', 100));
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const poseModelRef = useRef<any>(null);

  // Result animation
  const badgeScale = useSharedValue(0);
  const badgeGlow = useSharedValue(0.3);

  // Handle countdown timer during PUSHUPS and SITUPS
  useEffect(() => {
    if (stage !== 'PUSHUPS' && stage !== 'SITUPS') return;

    setTimeLeft(60);
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          if (stage === 'PUSHUPS') {
            transitionToSitups();
          } else {
            finalizeEvaluation();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [stage]);

  const handleLandmarks = useCallback((landmarks: Landmark[]) => {
    const evalResult = evaluatorRef.current.evaluateFrame(landmarks);
    setExerciseState(evalResult.state);

    if (evalResult.repIncremented) {
      alarmAudio.playCorrectSound();
      if (evaluatorRef.current['exercise'] === 'pushups') {
        setPushupReps(evalResult.state.reps);
      } else {
        setSitupReps(evalResult.state.reps);
      }
    }
  }, []);

  // Web Camera & MediaPipe
  useEffect(() => {
    if (Platform.OS !== 'web' || (stage !== 'PUSHUPS' && stage !== 'SITUPS')) return;

    let isMounted = true;
    let stream: MediaStream | null = null;

    const startCamera = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });

        if (!isMounted) return;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (err) {
        console.warn('[Camera] error:', err);
      }
    };

    void startCamera();

    const loadMediaPipe = async () => {
      if ((window as any).Pose) {
        initPose();
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js';
      script.crossOrigin = 'anonymous';
      script.onload = () => initPose();
      document.body.appendChild(script);
    };

    const initPose = () => {
      try {
        const PoseClass = (window as any).Pose;
        if (!PoseClass) return;

        const pose = new PoseClass({
          locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
        });

        pose.setOptions({
          modelComplexity: 1,
          smoothLandmarks: true,
          enableSegmentation: false,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        pose.onResults((results: any) => {
          if (!isMounted) return;
          const canvas = canvasRef.current;
          if (canvas && canvas.getContext) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              if (results.poseLandmarks) {
                const landmarks: Landmark[] = results.poseLandmarks;

                // Draw bones in neon cyan
                ctx.lineWidth = 4;
                ctx.strokeStyle = '#00e5ff';
                ctx.shadowColor = '#00e5ff';
                ctx.shadowBlur = 8;

                for (const [startIdx, endIdx] of POSE_CONNECTIONS) {
                  const p1 = landmarks[startIdx];
                  const p2 = landmarks[endIdx];
                  if (p1 && p2 && (p1.visibility ?? 1) > 0.4 && (p2.visibility ?? 1) > 0.4) {
                    ctx.beginPath();
                    ctx.moveTo(p1.x * canvas.width, p1.y * canvas.height);
                    ctx.lineTo(p2.x * canvas.width, p2.y * canvas.height);
                    ctx.stroke();
                  }
                }

                // Draw joint nodes
                for (const lm of landmarks) {
                  if ((lm.visibility ?? 1) > 0.4) {
                    ctx.beginPath();
                    ctx.arc(lm.x * canvas.width, lm.y * canvas.height, 5, 0, 2 * Math.PI);
                    ctx.fillStyle = '#ffb25c';
                    ctx.shadowColor = '#ffb25c';
                    ctx.shadowBlur = 10;
                    ctx.fill();
                  }
                }

                handleLandmarks(landmarks);
              }
            }
          }
        });

        poseModelRef.current = pose;

        const sendFrame = async () => {
          if (videoRef.current && videoRef.current.readyState >= 2 && poseModelRef.current) {
            try {
              await poseModelRef.current.send({ image: videoRef.current });
            } catch {}
          }
          if (isMounted) {
            animationFrameRef.current = requestAnimationFrame(sendFrame);
          }
        };

        sendFrame();
      } catch (e) {
        console.warn('[MediaPipe] Init error:', e);
      }
    };

    void loadMediaPipe();

    return () => {
      isMounted = false;
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (poseModelRef.current) {
        try {
          poseModelRef.current.close();
        } catch {}
      }
    };
  }, [facingMode, handleLandmarks, stage]);

  const startAssessment = () => {
    evaluatorRef.current = new PoseEvaluator('pushups', 100);
    setStage('PUSHUPS');
  };

  const transitionToSitups = () => {
    alarmAudio.playCorrectSound();
    evaluatorRef.current = new PoseEvaluator('situps', 100);
    setStage('SITUPS');
  };

  const finalizeEvaluation = () => {
    setStage('EVALUATING');
    alarmAudio.playCorrectSound();

    const currentPushups = evaluatorRef.current['exercise'] === 'pushups' ? evaluatorRef.current['reps'] : pushupReps;
    const currentSitups = evaluatorRef.current['exercise'] === 'situps' ? evaluatorRef.current['reps'] : situpReps;

    const evaluated = evaluateHunterAssessment(currentPushups, currentSitups);
    setResult(evaluated);

    setTimeout(() => {
      setStage('RESULT');
      alarmAudio.playCorrectSound();
      badgeScale.value = withSpring(1, { damping: 9, stiffness: 80 });
      badgeGlow.value = withRepeat(
        withSequence(withTiming(1, { duration: 1200 }), withTiming(0.3, { duration: 1200 })),
        -1,
        true
      );
    }, 1800);
  };

  const handleSimulateRep = () => {
    if (stage === 'PUSHUPS') {
      const next = pushupReps + 1;
      setPushupReps(next);
      setExerciseState((prev) => ({ ...prev, reps: next, stage: 'UP' }));
      alarmAudio.playCorrectSound();
    } else if (stage === 'SITUPS') {
      const next = situpReps + 1;
      setSitupReps(next);
      setExerciseState((prev) => ({ ...prev, reps: next, stage: 'DOWN' }));
      alarmAudio.playCorrectSound();
    }
  };

  const confirmExit = () => {
    Alert.alert(
      'FORFEIT ASSESSMENT?',
      'Leaving now will assign default E-Rank classification.',
      [
        { text: 'RESUME TRIAL', style: 'cancel' },
        { text: 'FORFEIT', style: 'destructive', onPress: onBack },
      ]
    );
  };

  const rankBadgeAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: badgeScale.value }],
    shadowOpacity: badgeGlow.value,
  }));

  const getRankColor = (rank: string) => {
    switch (rank) {
      case 'S': return '#b693ff';
      case 'A': return '#ffb25c';
      case 'B': return '#00e5ff';
      case 'C': return '#75e2b6';
      case 'D': return '#5599e2';
      default: return '#c9a227';
    }
  };

  return (
    <View style={styles.container}>
      {/* ─── STAGE 1: BRIEFING ─── */}
      {stage === 'BRIEFING' && (
        <ScrollView contentContainerStyle={styles.briefingScroll}>
          <View style={styles.systemBox}>
            <View style={styles.beaconRow}>
              <View style={styles.beaconGold} />
              <Text style={styles.systemTitle}>[SYSTEM] AWAKENING RANK ASSESSMENT</Text>
            </View>
            <Text style={styles.systemSubtitle}>
              Hunter {hunterName.toUpperCase()}, the System requires a physical evaluation to calibrate your official Hunter Rank and starting Level.
            </Text>
          </View>

          <View style={styles.cautionCard}>
            <View style={styles.cautionHeader}>
              <Feather name="alert-triangle" size={16} color="#ff2a55" />
              <Text style={styles.cautionTitle}>ONE-GO PROTOCOL // NO REPEATS</Text>
            </View>
            <Text style={styles.cautionBody}>
              This assessment must be completed in one continuous session. You will be evaluated on 2 trials:
            </Text>
            <View style={styles.trialList}>
              <Text style={styles.trialItem}>• Stage 1: Push-ups (60s Maximum Reps) — Strength & Stamina</Text>
              <Text style={styles.trialItem}>• Stage 2: Sit-ups (60s Maximum Reps) — Core & Endurance</Text>
            </View>
          </View>

          <View style={styles.rankLegendCard}>
            <Text style={styles.legendTitle}>RANK THRESHOLDS (COMBINED REPS)</Text>
            <View style={styles.legendRow}>
              <Text style={[styles.legendRank, { color: '#b693ff' }]}>S-RANK</Text>
              <Text style={styles.legendReq}>95+ Reps (Level 50)</Text>
            </View>
            <View style={styles.legendRow}>
              <Text style={[styles.legendRank, { color: '#ffb25c' }]}>A-RANK</Text>
              <Text style={styles.legendReq}>75-94 Reps (Level 35)</Text>
            </View>
            <View style={styles.legendRow}>
              <Text style={[styles.legendRank, { color: '#00e5ff' }]}>B-RANK</Text>
              <Text style={styles.legendReq}>55-74 Reps (Level 25)</Text>
            </View>
            <View style={styles.legendRow}>
              <Text style={[styles.legendRank, { color: '#75e2b6' }]}>C-RANK</Text>
              <Text style={styles.legendReq}>35-54 Reps (Level 15)</Text>
            </View>
            <View style={styles.legendRow}>
              <Text style={[styles.legendRank, { color: '#5599e2' }]}>D-RANK</Text>
              <Text style={styles.legendReq}>15-34 Reps (Level 8)</Text>
            </View>
            <View style={styles.legendRow}>
              <Text style={[styles.legendRank, { color: '#c9a227' }]}>E-RANK</Text>
              <Text style={styles.legendReq}>&lt;15 Reps (Level 1)</Text>
            </View>
          </View>

          <View style={styles.briefingActions}>
            <TouchableOpacity style={styles.startAssessmentBtn} onPress={startAssessment} activeOpacity={0.85}>
              <Text style={styles.startAssessmentBtnText}>COMMENCE AI ASSESSMENT</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.skipBtn} onPress={onBack} activeOpacity={0.75}>
              <Text style={styles.skipBtnText}>SKIP AND ASSIGN E-RANK</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* ─── STAGE 2: PUSH-UPS & SIT-UPS CAMERA HUD ─── */}
      {(stage === 'PUSHUPS' || stage === 'SITUPS') && (
        <View style={StyleSheet.absoluteFill}>
          {Platform.OS === 'web' ? (
            <View style={styles.cameraContainer}>
              <video
                ref={videoRef as any}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  transform: facingMode === 'user' ? 'scaleX(-1)' : 'none',
                }}
                playsInline
                muted
                autoPlay
              />
              <canvas
                ref={canvasRef as any}
                width={640}
                height={480}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  transform: facingMode === 'user' ? 'scaleX(-1)' : 'none',
                  pointerEvents: 'none',
                }}
              />
            </View>
          ) : (
            <View style={styles.nativeCameraFallback}>
              <Feather name="video" size={48} color="rgba(0, 229, 255, 0.4)" />
              <Text style={styles.nativeCameraText}>System Visual Sensors Live</Text>
            </View>
          )}

          {/* Top Bar */}
          <View style={styles.topHud}>
            <TouchableOpacity style={styles.hudIconBtn} onPress={confirmExit}>
              <Feather name="x" size={20} color="#e1e7f5" />
            </TouchableOpacity>

            <View style={styles.protocolBadge}>
              <Text style={styles.protocolText}>
                {stage === 'PUSHUPS' ? 'STAGE 1 OF 2 // PUSH-UPS' : 'STAGE 2 OF 2 // SIT-UPS'}
              </Text>
            </View>

            <View style={styles.timerBadge}>
              <Feather name="clock" size={14} color="#ffb25c" />
              <Text style={styles.timerText}>{timeLeft}s</Text>
            </View>
          </View>

          {/* Center Telemetry & Rep Count */}
          <View style={styles.centerHud}>
            <View style={styles.repCounterCard}>
              <Text style={styles.repCountBig}>
                {stage === 'PUSHUPS' ? pushupReps : situpReps}
              </Text>
              <Text style={styles.repTargetLabel}>REPS VERIFIED</Text>
            </View>

            <View style={styles.telemetryRow}>
              <View style={styles.telemetryCell}>
                <Text style={styles.telemetryValue}>
                  {exerciseState.angle > 0 ? `${exerciseState.angle}°` : '--'}
                </Text>
                <Text style={styles.telemetryLabel}>
                  {stage === 'PUSHUPS' ? 'ELBOW ANGLE' : 'HIP ANGLE'}
                </Text>
              </View>
              <View style={styles.telemetryDivider} />
              <View style={styles.telemetryCell}>
                <Text
                  style={[
                    styles.telemetryValue,
                    exerciseState.stage === 'DOWN' ? { color: '#00e5ff' } : { color: '#ffb25c' },
                  ]}
                >
                  {exerciseState.stage}
                </Text>
                <Text style={styles.telemetryLabel}>STAGE</Text>
              </View>
            </View>

            <View style={styles.guidanceBox}>
              <Feather name="info" size={14} color="#00e5ff" />
              <Text style={styles.guidanceText}>{exerciseState.formFeedback}</Text>
            </View>
          </View>

          {/* Bottom Stage Action */}
          <View style={styles.bottomControls}>
            <TouchableOpacity style={styles.simBtn} onPress={handleSimulateRep} activeOpacity={0.8}>
              <Feather name="plus" size={16} color="#00e5ff" />
              <Text style={styles.simBtnText}>MANUAL VERIFY REP</Text>
            </TouchableOpacity>

            {stage === 'PUSHUPS' ? (
              <TouchableOpacity style={styles.nextStageBtn} onPress={transitionToSitups} activeOpacity={0.85}>
                <Text style={styles.nextStageBtnText}>STAGE 2: SIT-UPS ({pushupReps} Push-ups Done)</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.nextStageBtn} onPress={finalizeEvaluation} activeOpacity={0.85}>
                <Text style={styles.nextStageBtnText}>COMPLETE ASSESSMENT ({situpReps} Sit-ups Done)</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* ─── STAGE 3: EVALUATING ANIMATION ─── */}
      {stage === 'EVALUATING' && (
        <View style={styles.evaluatingContainer}>
          <View style={styles.scanningRune}>
            <Feather name="cpu" size={48} color="#ffb25c" />
          </View>
          <Text style={styles.evaluatingTitle}>[SYSTEM] PROCESSING BIOMECHANICAL DATA</Text>
          <Text style={styles.evaluatingSubtitle}>Calibrating Hunter Rank, starting Level, and Mana Density...</Text>
        </View>
      )}

      {/* ─── STAGE 4: RESULT SCREEN ─── */}
      {stage === 'RESULT' && result && (
        <ScrollView contentContainerStyle={styles.resultScroll}>
          <View style={styles.systemBox}>
            <Text style={styles.systemTitle}>[SYSTEM] AWAKENING RANK CERTIFIED</Text>
            <Text style={styles.systemSubtitle}>
              Hunter {hunterName.toUpperCase()}, your physical trial has concluded.
            </Text>
          </View>

          {/* Rank Badge Reveal */}
          <Animated.View
            style={[
              styles.rankResultBadge,
              {
                borderColor: getRankColor(result.rank),
                shadowColor: getRankColor(result.rank),
              },
              rankBadgeAnimatedStyle,
            ]}
          >
            <Text style={[styles.rankLetterBig, { color: getRankColor(result.rank) }]}>
              {result.rank}
            </Text>
            <Text style={[styles.rankSubText, { color: getRankColor(result.rank) }]}>
              RANK HUNTER
            </Text>
          </Animated.View>

          {/* Level & Title */}
          <View style={styles.levelTitleBox}>
            <Text style={styles.assignedLevel}>STARTING LEVEL {result.level}</Text>
            <Text style={styles.assignedTitle}>"{result.title}"</Text>
          </View>

          {/* Performance Breakdown */}
          <View style={styles.performanceCard}>
            <Text style={styles.perfHeader}>TRIAL PERFORMANCE</Text>
            <View style={styles.perfRow}>
              <Text style={styles.perfLabel}>Push-ups Verified:</Text>
              <Text style={styles.perfVal}>{result.pushupsReps} reps</Text>
            </View>
            <View style={styles.perfRow}>
              <Text style={styles.perfLabel}>Sit-ups Verified:</Text>
              <Text style={styles.perfVal}>{result.situpsReps} reps</Text>
            </View>
            <View style={[styles.perfRow, { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 8 }]}>
              <Text style={styles.perfLabelTotal}>Total Reps:</Text>
              <Text style={styles.perfValTotal}>{result.totalReps} reps</Text>
            </View>
          </View>

          {/* Attributes Allocated */}
          <View style={styles.statsCard}>
            <Text style={styles.statsHeader}>INITIAL ATTRIBUTES ALLOCATED</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statCell}>
                <Text style={styles.statNum}>{result.stats.STR}</Text>
                <Text style={styles.statName}>STR</Text>
              </View>
              <View style={styles.statCell}>
                <Text style={styles.statNum}>{result.stats.STAMINA}</Text>
                <Text style={styles.statName}>STA</Text>
              </View>
              <View style={styles.statCell}>
                <Text style={styles.statNum}>{result.stats.INT}</Text>
                <Text style={styles.statName}>INT</Text>
              </View>
              <View style={styles.statCell}>
                <Text style={styles.statNum}>{result.stats.DISCIPLINE}</Text>
                <Text style={styles.statName}>DIS</Text>
              </View>
            </View>
          </View>

          {/* Claim Action */}
          <TouchableOpacity
            style={styles.claimBtn}
            onPress={() => onComplete(result)}
            activeOpacity={0.85}
          >
            <Text style={styles.claimBtnText}>ACCEPT CLASSIFICATION & PROCEED</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050508',
  },
  briefingScroll: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 56 : 28,
    paddingBottom: 40,
    gap: 16,
  },
  systemBox: {
    borderWidth: 1,
    borderColor: '#c9a227',
    backgroundColor: 'rgba(201, 162, 39, 0.08)',
    borderRadius: 12,
    padding: 16,
    gap: 6,
  },
  beaconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  beaconGold: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#c9a227',
  },
  systemTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#c9a227',
    letterSpacing: 1.5,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  systemSubtitle: {
    fontSize: 12,
    color: '#e8d48a',
    lineHeight: 18,
  },
  cautionCard: {
    borderWidth: 1,
    borderColor: 'rgba(255, 42, 85, 0.4)',
    backgroundColor: 'rgba(255, 42, 85, 0.08)',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  cautionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cautionTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#ff2a55',
    letterSpacing: 1.2,
  },
  cautionBody: {
    fontSize: 11,
    color: '#ffb4c2',
    lineHeight: 16,
  },
  trialList: {
    gap: 4,
    marginTop: 4,
  },
  trialItem: {
    fontSize: 11,
    color: '#ffffff',
    fontWeight: '600',
  },
  rankLegendCard: {
    backgroundColor: '#0c0c14',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  legendTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.5)',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  legendRank: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
  },
  legendReq: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '600',
  },
  briefingActions: {
    gap: 10,
    marginTop: 12,
  },
  startAssessmentBtn: {
    backgroundColor: '#c9a227',
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#c9a227',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
  },
  startAssessmentBtnText: {
    color: '#050508',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
  },
  skipBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  skipBtnText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  cameraContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#070b13',
  },
  nativeCameraFallback: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#070b13',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  nativeCameraText: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 12,
    letterSpacing: 1.5,
    fontWeight: '800',
  },
  topHud: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 56 : 24,
    zIndex: 10,
  },
  hudIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(7, 11, 19, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  protocolBadge: {
    backgroundColor: 'rgba(7, 11, 19, 0.85)',
    borderWidth: 1,
    borderColor: '#00e5ff',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  protocolText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#00e5ff',
    letterSpacing: 1.2,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(7, 11, 19, 0.85)',
    borderWidth: 1,
    borderColor: '#ffb25c',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  timerText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#ffb25c',
  },
  centerHud: {
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 10,
    gap: 12,
  },
  repCounterCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(7, 11, 19, 0.85)',
    borderWidth: 1.5,
    borderColor: 'rgba(0, 229, 255, 0.4)',
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  repCountBig: {
    fontSize: 60,
    fontWeight: '900',
    color: '#ffffff',
    lineHeight: 64,
  },
  repTargetLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffb25c',
    letterSpacing: 1.5,
  },
  telemetryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(7, 11, 19, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 18,
    gap: 20,
  },
  telemetryCell: { alignItems: 'center' },
  telemetryValue: { fontSize: 18, fontWeight: '800', color: '#ffffff' },
  telemetryLabel: { fontSize: 9, fontWeight: '800', color: 'rgba(255, 255, 255, 0.5)', letterSpacing: 1, marginTop: 2 },
  telemetryDivider: { width: 1, height: 24, backgroundColor: 'rgba(255, 255, 255, 0.15)' },
  guidanceBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(7, 11, 19, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  guidanceText: { fontSize: 11, fontWeight: '700', color: '#7df3ff' },
  bottomControls: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    alignItems: 'center',
    zIndex: 10,
    gap: 10,
  },
  simBtn: {
    width: '100%',
    maxWidth: 320,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#00e5ff',
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  simBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#00e5ff',
    letterSpacing: 1.5,
  },
  nextStageBtn: {
    width: '100%',
    maxWidth: 320,
    height: 50,
    borderRadius: 10,
    backgroundColor: '#c9a227',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextStageBtnText: {
    color: '#050508',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  evaluatingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 16,
  },
  scanningRune: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(201, 162, 39, 0.15)',
    borderWidth: 2,
    borderColor: '#c9a227',
    alignItems: 'center',
    justifyContent: 'center',
  },
  evaluatingTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#c9a227',
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  evaluatingSubtitle: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
  },
  resultScroll: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 56 : 28,
    paddingBottom: 40,
    alignItems: 'center',
    gap: 16,
  },
  rankResultBadge: {
    width: 140,
    height: 140,
    borderRadius: 24,
    borderWidth: 3,
    backgroundColor: '#0c0c14',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 28,
  },
  rankLetterBig: {
    fontSize: 68,
    fontWeight: '900',
    lineHeight: 74,
  },
  rankSubText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
  },
  levelTitleBox: {
    alignItems: 'center',
    gap: 4,
  },
  assignedLevel: {
    fontSize: 16,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 2,
  },
  assignedTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#c9a227',
    fontStyle: 'italic',
  },
  performanceCard: {
    width: '100%',
    backgroundColor: '#0c0c14',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  perfHeader: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.4)',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  perfRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  perfLabel: { fontSize: 12, color: 'rgba(255, 255, 255, 0.7)' },
  perfVal: { fontSize: 13, fontWeight: '800', color: '#ffffff' },
  perfLabelTotal: { fontSize: 13, fontWeight: '800', color: '#c9a227' },
  perfValTotal: { fontSize: 14, fontWeight: '900', color: '#c9a227' },
  statsCard: {
    width: '100%',
    backgroundColor: '#0c0c14',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  statsHeader: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.4)',
    letterSpacing: 1.5,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
  },
  statNum: {
    fontSize: 20,
    fontWeight: '900',
    color: '#ffffff',
  },
  statName: {
    fontSize: 10,
    fontWeight: '800',
    color: '#c9a227',
    marginTop: 2,
  },
  claimBtn: {
    width: '100%',
    backgroundColor: '#c9a227',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#c9a227',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 14,
  },
  claimBtnText: {
    color: '#050508',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
  },
});

