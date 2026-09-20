import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
  Alert,
  Dimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
} from 'react-native-reanimated';
import {
  PoseEvaluator,
  ExerciseType,
  ExerciseState,
  POSE_CONNECTIONS,
  Landmark,
} from '@/utils/poseDetection';
import { alarmAudio } from '@/utils/alarmAudio';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface PoseTrackerScreenProps {
  exercise: ExerciseType;
  targetReps: number;
  questTitle: string;
  onComplete: (reps: number) => void;
  onBack: () => void;
}

export const PoseTrackerScreen = ({
  exercise,
  targetReps,
  questTitle,
  onComplete,
  onBack,
}: PoseTrackerScreenProps) => {
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraPermissionDenied, setCameraPermissionDenied] = useState<boolean>(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isCompleted, setIsCompleted] = useState<boolean>(false);

  const [state, setState] = useState<ExerciseState>({
    exercise,
    reps: 0,
    targetReps,
    stage: 'CALIBRATING',
    angle: 0,
    formFeedback: 'Initializing System Visual Sensors...',
    isGoodForm: true,
    leftConfidence: 0,
    rightConfidence: 0,
    activeSide: 'left',
  });

  const evaluatorRef = useRef<PoseEvaluator>(new PoseEvaluator(exercise, targetReps));
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const poseModelRef = useRef<any>(null);

  // Victory Scale animation
  const victoryScale = useSharedValue(0.8);
  const victoryOpacity = useSharedValue(0);

  const animatedVictoryStyle = useAnimatedStyle(() => ({
    transform: [{ scale: victoryScale.value }],
    opacity: victoryOpacity.value,
  }));

  const handleRepVictory = useCallback(() => {
    setIsCompleted(true);
    alarmAudio.playCorrectSound();
    victoryScale.value = withTiming(1, { duration: 400 });
    victoryOpacity.value = withTiming(1, { duration: 400 });

    setTimeout(() => {
      onComplete(evaluatorRef.current['reps']);
    }, 2400);
  }, [onComplete, victoryOpacity, victoryScale]);

  // Handle a new frame of landmarks
  const handleLandmarks = useCallback((landmarks: Landmark[]) => {
    const result = evaluatorRef.current.evaluateFrame(landmarks);
    setState(result.state);

    if (result.repIncremented) {
      alarmAudio.playCorrectSound();
      if (result.state.reps >= targetReps) {
        handleRepVictory();
      }
    }
  }, [handleRepVictory, targetReps]);

  // Web camera & MediaPipe initialization
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    let isMounted = true;
    let stream: MediaStream | null = null;

    const startCamera = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setCameraPermissionDenied(true);
          return;
        }

        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode,
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: false,
        });

        if (!isMounted) return;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setCameraActive(true);
          setCameraPermissionDenied(false);
        }
      } catch (err) {
        console.warn('[Camera] Failed to access camera:', err);
        setCameraPermissionDenied(true);
      }
    };

    void startCamera();

    // Dynamically load MediaPipe Pose script if not present
    const loadMediaPipe = async () => {
      if ((window as any).Pose) {
        initPoseModel();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js';
      script.crossOrigin = 'anonymous';
      script.onload = () => {
        initPoseModel();
      };
      script.onerror = () => {
        console.warn('[MediaPipe] Could not load CDN script. Using telemetry fallback.');
      };
      document.body.appendChild(script);
    };

    const initPoseModel = () => {
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

          // Draw skeleton wireframe on canvas
          const canvas = canvasRef.current;
          const video = videoRef.current;
          if (canvas && video && canvas.getContext) {
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
                  if (
                    p1 && p2 &&
                    (p1.visibility ?? 1) > 0.4 &&
                    (p2.visibility ?? 1) > 0.4
                  ) {
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

                // Pass landmarks to Biomechanical State Evaluator
                handleLandmarks(landmarks);
              }
            }
          }
        });

        poseModelRef.current = pose;

        // Process video frames
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
  }, [facingMode, handleLandmarks]);

  const toggleCameraFacing = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  const handleSimulateRep = () => {
    const nextReps = state.reps + 1;
    setState((prev) => ({
      ...prev,
      reps: nextReps,
      stage: 'UP',
      angle: 165,
      formFeedback: 'Rep verified via simulated sensor',
    }));
    alarmAudio.playCorrectSound();
    if (nextReps >= targetReps) {
      handleRepVictory();
    }
  };

  const confirmExit = () => {
    Alert.alert(
      'ABORT SENSOR QUEST?',
      'Exiting will reset this exercise trial.',
      [
        { text: 'RESUME', style: 'cancel' },
        { text: 'ABORT', style: 'destructive', onPress: onBack },
      ]
    );
  };

  const progressPercent = Math.min(100, Math.round((state.reps / targetReps) * 100));

  return (
    <View style={styles.container}>
      {/* Background Camera View (Web / Native) */}
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

      {/* Top HUD Bar */}
      <View style={styles.topHud}>
        <TouchableOpacity style={styles.hudIconBtn} onPress={confirmExit}>
          <Feather name="x" size={20} color="#e1e7f5" />
        </TouchableOpacity>

        <View style={styles.protocolBadge}>
          <View style={styles.activeBeacon} />
          <Text style={styles.protocolText}>[SYSTEM] VISUAL SENSOR ACTIVE</Text>
        </View>

        {Platform.OS === 'web' && (
          <TouchableOpacity style={styles.hudIconBtn} onPress={toggleCameraFacing}>
            <Feather name="refresh-cw" size={18} color="#00e5ff" />
          </TouchableOpacity>
        )}
      </View>

      {/* Exercise Title Banner */}
      <View style={styles.titleBanner}>
        <Text style={styles.questEyebrow}>
          {exercise === 'pushups' ? 'STRENGTH CALIBRATION' : 'CORE CALIBRATION'}
        </Text>
        <Text style={styles.questTitle}>{questTitle.toUpperCase()}</Text>
      </View>

      {/* Center Rep Counter & Telemetry HUD */}
      <View style={styles.centerHud}>
        <View style={styles.repCounterCard}>
          <Text style={styles.repCountBig}>{state.reps}</Text>
          <Text style={styles.repTargetLabel}>/ {targetReps} REPS</Text>
          <View style={styles.progressPctBadge}>
            <Text style={styles.progressPctText}>{progressPercent}% COMPLETE</Text>
          </View>
        </View>

        {/* Live Angle & Stage Telemetry */}
        <View style={styles.telemetryRow}>
          <View style={styles.telemetryCell}>
            <Text style={styles.telemetryValue}>
              {state.angle > 0 ? `${state.angle}°` : '--'}
            </Text>
            <Text style={styles.telemetryLabel}>
              {exercise === 'pushups' ? 'ELBOW ANGLE' : 'HIP ANGLE'}
            </Text>
          </View>

          <View style={styles.telemetryDivider} />

          <View style={styles.telemetryCell}>
            <Text
              style={[
                styles.telemetryValue,
                state.stage === 'DOWN' ? { color: '#00e5ff' } : { color: '#ffb25c' },
              ]}
            >
              {state.stage}
            </Text>
            <Text style={styles.telemetryLabel}>STAGE</Text>
          </View>
        </View>

        {/* Form Guidance Feedback Banner */}
        <View
          style={[
            styles.guidanceBox,
            !state.isGoodForm && styles.guidanceBoxWarning,
          ]}
        >
          <Feather
            name={state.isGoodForm ? 'check-circle' : 'alert-triangle'}
            size={16}
            color={state.isGoodForm ? '#00e5ff' : '#ff2a55'}
          />
          <Text
            style={[
              styles.guidanceText,
              !state.isGoodForm && { color: '#ff8e3c' },
            ]}
          >
            {state.formFeedback}
          </Text>
        </View>
      </View>

      {/* Bottom Controls */}
      <View style={styles.bottomControls}>
        <TouchableOpacity
          style={styles.simBtn}
          onPress={handleSimulateRep}
          activeOpacity={0.8}
        >
          <Feather name="plus" size={16} color="#00e5ff" />
          <Text style={styles.simBtnText}>MANUAL VERIFY REP</Text>
        </TouchableOpacity>

        {cameraPermissionDenied && (
          <Text style={styles.permissionWarning}>
            Camera access is optional. You can use the manual verify button above.
          </Text>
        )}
      </View>

      {/* Victory Completed Modal */}
      {isCompleted && (
        <View style={styles.victoryOverlay}>
          <Animated.View style={[styles.victoryCard, animatedVictoryStyle]}>
            <View style={styles.victoryCircle}>
              <Feather name="check" size={44} color="#070b13" />
            </View>
            <Text style={styles.victorySystemText}>[SYSTEM] OBJECTIVE ACHIEVED</Text>
            <Text style={styles.victoryTitle}>TRIAL VERIFIED BY AI SENSOR</Text>
            <View style={styles.rewardTag}>
              <Text style={styles.rewardTagText}>
                +{exercise === 'pushups' ? '40' : '40'} XP · +1 {exercise === 'pushups' ? 'STR' : 'STAMINA'}
              </Text>
            </View>
          </Animated.View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050811',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 48 : 24,
    paddingBottom: Platform.OS === 'ios' ? 36 : 16,
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
    zIndex: 10,
  },
  hudIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(7, 11, 19, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  protocolBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(7, 11, 19, 0.85)',
    borderWidth: 1,
    borderColor: '#00e5ff',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    shadowColor: '#00e5ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
  },
  activeBeacon: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00e5ff',
  },
  protocolText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#00e5ff',
    letterSpacing: 1.2,
  },
  titleBanner: {
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 10,
  },
  questEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    color: '#ffb25c',
    letterSpacing: 2,
  },
  questTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 1.5,
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
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
    paddingVertical: 16,
    paddingHorizontal: 32,
    shadowColor: '#00e5ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  repCountBig: {
    fontSize: 64,
    fontWeight: '900',
    color: '#ffffff',
    lineHeight: 68,
    letterSpacing: 2,
  },
  repTargetLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffb25c',
    letterSpacing: 1.5,
  },
  progressPctBadge: {
    marginTop: 8,
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    borderWidth: 1,
    borderColor: '#00e5ff',
  },
  progressPctText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#00e5ff',
    letterSpacing: 1,
  },
  telemetryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(7, 11, 19, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 18,
    gap: 20,
  },
  telemetryCell: {
    alignItems: 'center',
  },
  telemetryValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
  },
  telemetryLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.5)',
    letterSpacing: 1,
    marginTop: 2,
  },
  telemetryDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  guidanceBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(7, 11, 19, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    maxWidth: 340,
  },
  guidanceBoxWarning: {
    borderColor: 'rgba(255, 42, 85, 0.4)',
    backgroundColor: 'rgba(255, 42, 85, 0.08)',
  },
  guidanceText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7df3ff',
    letterSpacing: 0.5,
    flex: 1,
  },
  bottomControls: {
    paddingHorizontal: 20,
    alignItems: 'center',
    zIndex: 10,
    gap: 8,
  },
  simBtn: {
    width: '100%',
    maxWidth: 320,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#00e5ff',
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  simBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#00e5ff',
    letterSpacing: 1.5,
  },
  permissionWarning: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.4)',
    textAlign: 'center',
  },
  victoryOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(5, 8, 17, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    zIndex: 99,
  },
  victoryCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#0c101d',
    borderWidth: 2,
    borderColor: '#00e5ff',
    borderRadius: 20,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#00e5ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
  },
  victoryCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#00e5ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    shadowColor: '#00e5ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 14,
  },
  victorySystemText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#00e5ff',
    letterSpacing: 2,
    marginBottom: 6,
  },
  victoryTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 1.5,
    textAlign: 'center',
    marginBottom: 16,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  rewardTag: {
    backgroundColor: 'rgba(255, 178, 92, 0.15)',
    borderWidth: 1,
    borderColor: '#ffb25c',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  rewardTagText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffb25c',
    letterSpacing: 1.2,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
});
