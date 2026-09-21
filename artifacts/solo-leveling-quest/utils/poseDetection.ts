/**
 * poseDetection.ts
 *
 * Google MediaPipe / BlazePose Pose Landmarker on-device AI integration.
 * Calculates real-time 3D joint angles and implements biomechanical state machines
 * for counting Push-ups and Sit-ups with form validation.
 *
 * v2 — Improved tracking accuracy:
 *   • Exponential Moving Average (EMA) angle smoothing
 *   • Bilateral joint averaging weighted by visibility
 *   • Hysteresis-based state machine (separate enter/exit thresholds)
 *   • Comprehensive multi-point form validation
 *   • Anti-cheat: velocity cap, bottom-hold requirement, visibility gate
 *   • Calibration phase (first ~500ms)
 */

export interface Landmark {
  x: number; // Normalized 0..1
  y: number; // Normalized 0..1
  z: number;
  visibility?: number;
}

export type ExerciseType = 'pushups' | 'situps';

export interface ExerciseState {
  exercise: ExerciseType;
  reps: number;
  targetReps: number;
  stage: 'UP' | 'DOWN' | 'TRANSITION' | 'CALIBRATING';
  angle: number; // Smoothed primary joint angle in degrees
  rawAngle: number; // Unsmoothed angle for debug
  formFeedback: string;
  isGoodForm: boolean;
  formIssues: string[]; // All active form problems
  leftConfidence: number;
  rightConfidence: number;
  activeSide: 'left' | 'right';
  repQuality: 'PERFECT' | 'GOOD' | 'PARTIAL' | null;
  consecutiveGoodForm: number;
}

// MediaPipe Landmark Indices
export const POSE_LANDMARKS = {
  NOSE: 0,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
};

// Skeletal connections for drawing wireframes
export const POSE_CONNECTIONS: [number, number][] = [
  // Torso
  [POSE_LANDMARKS.LEFT_SHOULDER, POSE_LANDMARKS.RIGHT_SHOULDER],
  [POSE_LANDMARKS.LEFT_SHOULDER, POSE_LANDMARKS.LEFT_HIP],
  [POSE_LANDMARKS.RIGHT_SHOULDER, POSE_LANDMARKS.RIGHT_HIP],
  [POSE_LANDMARKS.LEFT_HIP, POSE_LANDMARKS.RIGHT_HIP],
  // Left Arm
  [POSE_LANDMARKS.LEFT_SHOULDER, POSE_LANDMARKS.LEFT_ELBOW],
  [POSE_LANDMARKS.LEFT_ELBOW, POSE_LANDMARKS.LEFT_WRIST],
  // Right Arm
  [POSE_LANDMARKS.RIGHT_SHOULDER, POSE_LANDMARKS.RIGHT_ELBOW],
  [POSE_LANDMARKS.RIGHT_ELBOW, POSE_LANDMARKS.RIGHT_WRIST],
  // Left Leg
  [POSE_LANDMARKS.LEFT_HIP, POSE_LANDMARKS.LEFT_KNEE],
  [POSE_LANDMARKS.LEFT_KNEE, POSE_LANDMARKS.LEFT_ANKLE],
  // Right Leg
  [POSE_LANDMARKS.RIGHT_HIP, POSE_LANDMARKS.RIGHT_KNEE],
  [POSE_LANDMARKS.RIGHT_KNEE, POSE_LANDMARKS.RIGHT_ANKLE],
];

// ─── Tunable constants ───────────────────────────────────────

/** EMA smoothing factor (0 = no smoothing, 1 = no memory). 0.35 is a good balance. */
const EMA_ALPHA = 0.35;

/** Minimum milliseconds between two counted reps */
const MIN_REP_INTERVAL_MS = 1200;

/** Consecutive frames at the extreme position required to confirm a phase */
const HOLD_FRAMES_REQUIRED = 3;

/** Max degrees of angle change per frame — anything beyond is noise or cheating */
const MAX_ANGULAR_VELOCITY = 25;

/** Frames spent in calibration before counting begins */
const CALIBRATION_FRAMES = 15;

/** Minimum visibility score (0–1) for a joint to be considered reliable */
const MIN_JOINT_VISIBILITY = 0.5;

// Push-up thresholds (hysteresis)
const PUSHUP_DOWN_ENTER = 85; // Elbow angle to enter DOWN
const PUSHUP_UP_ENTER = 160; // Elbow angle to enter UP
const PUSHUP_PLANK_MIN = 155; // Shoulder-Hip-Ankle alignment minimum

// Sit-up thresholds (hysteresis)
const SITUP_UP_ENTER = 70; // Hip angle to enter UP (peak flexion)
const SITUP_DOWN_ENTER = 140; // Hip angle to enter DOWN (lying)
const SITUP_KNEE_MIN = 50; // Knee angle minimum (bent)
const SITUP_KNEE_MAX = 110; // Knee angle maximum

// ──────────────────────────────────────────────────────────────

/**
 * Calculates 3-point angle in degrees formed by point A, vertex B, and point C.
 */
export function calculateAngle(a: Landmark, b: Landmark, c: Landmark): number {
  const radians =
    Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs((radians * 180.0) / Math.PI);
  if (angle > 180.0) {
    angle = 360.0 - angle;
  }
  return Math.round(angle);
}

/**
 * Computes a visibility-weighted average of left and right side angles.
 * Falls back to whichever side is visible if one side is below threshold.
 */
function bilateralAngle(
  leftAngle: number,
  rightAngle: number,
  leftVis: number,
  rightVis: number,
): number {
  const leftOk = leftVis >= MIN_JOINT_VISIBILITY;
  const rightOk = rightVis >= MIN_JOINT_VISIBILITY;

  if (leftOk && rightOk) {
    // Weighted average by visibility confidence
    const total = leftVis + rightVis;
    return Math.round((leftAngle * leftVis + rightAngle * rightVis) / total);
  }
  if (leftOk) return leftAngle;
  if (rightOk) return rightAngle;
  // Neither side is reliable — return average as best effort
  return Math.round((leftAngle + rightAngle) / 2);
}

/**
 * Average visibility of a set of landmarks.
 */
function avgVisibility(...landmarks: Landmark[]): number {
  const sum = landmarks.reduce((acc, lm) => acc + (lm.visibility ?? 0), 0);
  return sum / landmarks.length;
}

export class PoseEvaluator {
  private exercise: ExerciseType;
  private targetReps: number;
  private reps: number = 0;
  private stage: 'UP' | 'DOWN' | 'TRANSITION' | 'CALIBRATING' = 'CALIBRATING';

  // EMA state
  private smoothedAngle: number = 0;
  private previousRawAngle: number = 0;
  private hasSmoothedValue: boolean = false;

  // Hysteresis / hold tracking
  private wasAtExtreme: boolean = false; // true when user confirmed at DOWN (pushups) or UP (situps)
  private holdFrameCount: number = 0; // consecutive frames at the extreme
  private lastRepTimestamp: number = 0;

  // Calibration
  private frameCount: number = 0;

  // Form tracking
  private consecutiveGoodForm: number = 0;
  private lastRepGoodFormFrames: number = 0; // good-form frames during the last rep cycle
  private totalRepCycleFrames: number = 0; // total frames during the last rep cycle
  private lastRepQuality: 'PERFECT' | 'GOOD' | 'PARTIAL' | null = null;

  constructor(exercise: ExerciseType, targetReps: number = 20) {
    this.exercise = exercise;
    this.targetReps = targetReps;
  }

  public reset(targetReps?: number) {
    this.reps = 0;
    this.stage = 'CALIBRATING';
    this.wasAtExtreme = false;
    this.holdFrameCount = 0;
    this.lastRepTimestamp = 0;
    this.smoothedAngle = 0;
    this.previousRawAngle = 0;
    this.hasSmoothedValue = false;
    this.frameCount = 0;
    this.consecutiveGoodForm = 0;
    this.lastRepGoodFormFrames = 0;
    this.totalRepCycleFrames = 0;
    this.lastRepQuality = null;
    if (targetReps !== undefined) {
      this.targetReps = targetReps;
    }
  }

  /**
   * Process a single frame of 33 MediaPipe pose landmarks.
   */
  public evaluateFrame(landmarks: Landmark[]): {
    state: ExerciseState;
    repIncremented: boolean;
  } {
    // ── Insufficient data ──────────────────────────────────
    if (!landmarks || landmarks.length < 33) {
      return {
        state: this.buildState(0, 0, 'Position full body in camera frame', false, [], 'left', 0, 0),
        repIncremented: false,
      };
    }

    this.frameCount++;

    // ── Extract joints ─────────────────────────────────────
    const lShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
    const rShoulder = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
    const lElbow = landmarks[POSE_LANDMARKS.LEFT_ELBOW];
    const rElbow = landmarks[POSE_LANDMARKS.RIGHT_ELBOW];
    const lWrist = landmarks[POSE_LANDMARKS.LEFT_WRIST];
    const rWrist = landmarks[POSE_LANDMARKS.RIGHT_WRIST];
    const lHip = landmarks[POSE_LANDMARKS.LEFT_HIP];
    const rHip = landmarks[POSE_LANDMARKS.RIGHT_HIP];
    const lKnee = landmarks[POSE_LANDMARKS.LEFT_KNEE];
    const rKnee = landmarks[POSE_LANDMARKS.RIGHT_KNEE];
    const lAnkle = landmarks[POSE_LANDMARKS.LEFT_ANKLE];
    const rAnkle = landmarks[POSE_LANDMARKS.RIGHT_ANKLE];

    // ── Visibility scoring ─────────────────────────────────
    const leftArmVis = avgVisibility(lShoulder, lElbow, lWrist);
    const rightArmVis = avgVisibility(rShoulder, rElbow, rWrist);
    const leftBodyVis = avgVisibility(lShoulder, lHip, lKnee, lAnkle);
    const rightBodyVis = avgVisibility(rShoulder, rHip, rKnee, rAnkle);

    const leftScore = (leftArmVis + leftBodyVis) / 2;
    const rightScore = (rightArmVis + rightBodyVis) / 2;
    const activeSide: 'left' | 'right' = leftScore >= rightScore ? 'left' : 'right';

    // ── Visibility gate — reject frame if key joints are not visible ──
    const keyJointVis = this.exercise === 'pushups'
      ? [
          activeSide === 'left' ? lShoulder : rShoulder,
          activeSide === 'left' ? lElbow : rElbow,
          activeSide === 'left' ? lWrist : rWrist,
          activeSide === 'left' ? lHip : rHip,
        ]
      : [
          activeSide === 'left' ? lShoulder : rShoulder,
          activeSide === 'left' ? lHip : rHip,
          activeSide === 'left' ? lKnee : rKnee,
          activeSide === 'left' ? lAnkle : rAnkle,
        ];

    const visibleJointCount = keyJointVis.filter(
      (lm) => (lm.visibility ?? 0) > MIN_JOINT_VISIBILITY,
    ).length;

    if (visibleJointCount < 3) {
      return {
        state: this.buildState(
          this.smoothedAngle,
          0,
          'Move closer or adjust angle — key joints not visible',
          false,
          ['Low visibility'],
          activeSide,
          leftScore,
          rightScore,
        ),
        repIncremented: false,
      };
    }

    // ── Compute angles ─────────────────────────────────────
    let rawAngle: number;
    const formIssues: string[] = [];
    let isGoodForm = true;

    if (this.exercise === 'pushups') {
      rawAngle = this.computePushupAngle(
        lShoulder, rShoulder, lElbow, rElbow, lWrist, rWrist,
        leftArmVis, rightArmVis,
      );

      // ── Form checks ──────────────────────────────────────
      this.validatePushupForm(
        lShoulder, rShoulder, lHip, rHip, lAnkle, rAnkle,
        lWrist, rWrist, lElbow, rElbow,
        activeSide, leftBodyVis, rightBodyVis, formIssues,
      );
    } else {
      rawAngle = this.computeSitupAngle(
        lShoulder, rShoulder, lHip, rHip, lKnee, rKnee,
        leftBodyVis, rightBodyVis,
      );

      // ── Form checks ──────────────────────────────────────
      this.validateSitupForm(
        lHip, rHip, lKnee, rKnee, lAnkle, rAnkle,
        lShoulder, rShoulder,
        activeSide, leftBodyVis, rightBodyVis, formIssues,
      );
    }

    if (formIssues.length > 0) {
      isGoodForm = false;
    }

    // ── Angular velocity check ─────────────────────────────
    const angularDelta = Math.abs(rawAngle - this.previousRawAngle);
    const velocityExceeded =
      this.hasSmoothedValue && angularDelta > MAX_ANGULAR_VELOCITY;
    this.previousRawAngle = rawAngle;

    // ── EMA smoothing ──────────────────────────────────────
    if (!this.hasSmoothedValue) {
      this.smoothedAngle = rawAngle;
      this.hasSmoothedValue = true;
    } else {
      this.smoothedAngle = Math.round(
        EMA_ALPHA * rawAngle + (1 - EMA_ALPHA) * this.smoothedAngle,
      );
    }

    const angle = this.smoothedAngle;

    // ── Calibration phase ──────────────────────────────────
    if (this.frameCount <= CALIBRATION_FRAMES) {
      this.stage = 'CALIBRATING';
      const remaining = CALIBRATION_FRAMES - this.frameCount;
      return {
        state: this.buildState(
          angle, rawAngle,
          `Calibrating sensors... hold position (${remaining})`,
          true, [], activeSide, leftScore, rightScore,
        ),
        repIncremented: false,
      };
    }

    // ── Track form quality across rep cycle ─────────────────
    this.totalRepCycleFrames++;
    if (isGoodForm) {
      this.consecutiveGoodForm++;
      this.lastRepGoodFormFrames++;
    } else {
      this.consecutiveGoodForm = 0;
    }

    // ── State machine (with hysteresis + hold confirmation) ─
    let repIncremented = false;
    let formFeedback = '';
    const now = Date.now();

    if (this.exercise === 'pushups') {
      ({ repIncremented, formFeedback } = this.evaluatePushupState(
        angle, now, velocityExceeded, formIssues,
      ));
    } else {
      ({ repIncremented, formFeedback } = this.evaluateSitupState(
        angle, now, velocityExceeded, formIssues,
      ));
    }

    // Override feedback with form issue if present
    if (formIssues.length > 0 && !repIncremented) {
      formFeedback = formIssues[0];
    }

    return {
      state: this.buildState(
        angle, rawAngle, formFeedback, isGoodForm, formIssues,
        activeSide, leftScore, rightScore,
      ),
      repIncremented,
    };
  }

  // ── Push-up: bilateral elbow angle ───────────────────────
  private computePushupAngle(
    lShoulder: Landmark, rShoulder: Landmark,
    lElbow: Landmark, rElbow: Landmark,
    lWrist: Landmark, rWrist: Landmark,
    leftVis: number, rightVis: number,
  ): number {
    const leftAngle = calculateAngle(lShoulder, lElbow, lWrist);
    const rightAngle = calculateAngle(rShoulder, rElbow, rWrist);
    return bilateralAngle(leftAngle, rightAngle, leftVis, rightVis);
  }

  // ── Sit-up: bilateral hip angle ──────────────────────────
  private computeSitupAngle(
    lShoulder: Landmark, rShoulder: Landmark,
    lHip: Landmark, rHip: Landmark,
    lKnee: Landmark, rKnee: Landmark,
    leftVis: number, rightVis: number,
  ): number {
    const leftAngle = calculateAngle(lShoulder, lHip, lKnee);
    const rightAngle = calculateAngle(rShoulder, rHip, rKnee);
    return bilateralAngle(leftAngle, rightAngle, leftVis, rightVis);
  }

  // ── Push-up form validation ──────────────────────────────
  private validatePushupForm(
    lShoulder: Landmark, rShoulder: Landmark,
    lHip: Landmark, rHip: Landmark,
    lAnkle: Landmark, rAnkle: Landmark,
    lWrist: Landmark, rWrist: Landmark,
    _lElbow: Landmark, _rElbow: Landmark,
    activeSide: 'left' | 'right',
    leftBodyVis: number, rightBodyVis: number,
    issues: string[],
  ): void {
    // 1. Plank alignment: Shoulder → Hip → Ankle ≥ 155°
    const leftPlank = calculateAngle(lShoulder, lHip, lAnkle);
    const rightPlank = calculateAngle(rShoulder, rHip, rAnkle);
    const plankAngle = bilateralAngle(leftPlank, rightPlank, leftBodyVis, rightBodyVis);

    if (plankAngle < PUSHUP_PLANK_MIN) {
      if (plankAngle < 130) {
        issues.push('Hips sagging — tighten core!');
      } else {
        issues.push('Keep hips level with shoulders');
      }
    }

    // 2. Elbow flare check: wrist should be roughly under shoulder (x-axis)
    const shoulder = activeSide === 'left' ? lShoulder : rShoulder;
    const wrist = activeSide === 'left' ? lWrist : rWrist;
    const horizontalDrift = Math.abs(shoulder.x - wrist.x);
    if (horizontalDrift > 0.15) {
      issues.push('Hands too wide — tuck elbows closer');
    }
  }

  // ── Sit-up form validation ───────────────────────────────
  private validateSitupForm(
    lHip: Landmark, rHip: Landmark,
    lKnee: Landmark, rKnee: Landmark,
    lAnkle: Landmark, rAnkle: Landmark,
    lShoulder: Landmark, rShoulder: Landmark,
    activeSide: 'left' | 'right',
    leftBodyVis: number, rightBodyVis: number,
    issues: string[],
  ): void {
    // 1. Knee angle stability: Hip → Knee → Ankle should be 50°–110° (knees bent)
    const leftKneeAngle = calculateAngle(lHip, lKnee, lAnkle);
    const rightKneeAngle = calculateAngle(rHip, rKnee, rAnkle);
    const kneeAngle = bilateralAngle(leftKneeAngle, rightKneeAngle, leftBodyVis, rightBodyVis);

    if (kneeAngle < SITUP_KNEE_MIN) {
      issues.push('Legs too tucked — extend slightly');
    } else if (kneeAngle > SITUP_KNEE_MAX) {
      issues.push('Bend knees more — feet flat on floor');
    }

    // 2. Torso must actually rise: shoulder-y should be meaningfully above hip-y during UP
    const shoulder = activeSide === 'left' ? lShoulder : rShoulder;
    const hip = activeSide === 'left' ? lHip : rHip;
    if (this.stage === 'UP' && shoulder.y >= hip.y - 0.02) {
      issues.push('Raise torso higher toward knees');
    }
  }

  // ── Push-up state machine ────────────────────────────────
  private evaluatePushupState(
    angle: number,
    now: number,
    velocityExceeded: boolean,
    formIssues: string[],
  ): { repIncremented: boolean; formFeedback: string } {
    let repIncremented = false;
    let formFeedback = '';

    if (angle < PUSHUP_DOWN_ENTER) {
      // ── At the bottom position ──
      this.holdFrameCount++;
      this.stage = 'DOWN';

      if (this.holdFrameCount >= HOLD_FRAMES_REQUIRED) {
        this.wasAtExtreme = true;
        formFeedback = 'Good depth! Push back up';
      } else {
        formFeedback = 'Hold at bottom...';
      }
    } else if (angle > PUSHUP_UP_ENTER) {
      // ── At the top position ──
      this.stage = 'UP';

      if (
        this.wasAtExtreme &&
        !velocityExceeded &&
        now - this.lastRepTimestamp > MIN_REP_INTERVAL_MS
      ) {
        // ── Valid rep! ──
        this.reps++;
        repIncremented = true;
        this.lastRepTimestamp = now;
        this.wasAtExtreme = false;
        this.holdFrameCount = 0;

        // Assess rep quality
        this.lastRepQuality = this.assessRepQuality(formIssues);
        this.lastRepGoodFormFrames = 0;
        this.totalRepCycleFrames = 0;

        formFeedback =
          this.lastRepQuality === 'PERFECT' ? 'Perfect rep!' :
          this.lastRepQuality === 'GOOD' ? 'Good rep!' :
          'Rep counted — improve form';
      } else if (this.wasAtExtreme && velocityExceeded) {
        formFeedback = 'Too fast — controlled movement only';
      } else {
        formFeedback = 'Lower chest to 90° elbow bend';
      }
    } else {
      // ── Transition zone ──
      this.stage = 'TRANSITION';
      this.holdFrameCount = 0;

      if (!this.wasAtExtreme) {
        formFeedback = 'Lower chest further down';
      } else {
        formFeedback = 'Push arms fully straight';
      }
    }

    return { repIncremented, formFeedback };
  }

  // ── Sit-up state machine ─────────────────────────────────
  private evaluateSitupState(
    angle: number,
    now: number,
    velocityExceeded: boolean,
    formIssues: string[],
  ): { repIncremented: boolean; formFeedback: string } {
    let repIncremented = false;
    let formFeedback = '';

    if (angle < SITUP_UP_ENTER) {
      // ── At peak flexion (torso raised) ──
      this.holdFrameCount++;
      this.stage = 'UP';

      if (this.holdFrameCount >= HOLD_FRAMES_REQUIRED) {
        this.wasAtExtreme = true;
        formFeedback = 'Peak contraction! Lower smoothly';
      } else {
        formFeedback = 'Hold at the top...';
      }
    } else if (angle > SITUP_DOWN_ENTER) {
      // ── Lying down / start position ──
      this.stage = 'DOWN';

      if (
        this.wasAtExtreme &&
        !velocityExceeded &&
        now - this.lastRepTimestamp > MIN_REP_INTERVAL_MS
      ) {
        // ── Valid rep! ──
        this.reps++;
        repIncremented = true;
        this.lastRepTimestamp = now;
        this.wasAtExtreme = false;
        this.holdFrameCount = 0;

        this.lastRepQuality = this.assessRepQuality(formIssues);
        this.lastRepGoodFormFrames = 0;
        this.totalRepCycleFrames = 0;

        formFeedback =
          this.lastRepQuality === 'PERFECT' ? 'Perfect rep!' :
          this.lastRepQuality === 'GOOD' ? 'Good rep!' :
          'Rep counted — improve form';
      } else if (this.wasAtExtreme && velocityExceeded) {
        formFeedback = 'Too fast — use controlled motion';
      } else {
        formFeedback = 'Crunch up toward your knees';
      }
    } else {
      // ── Transition zone ──
      this.stage = 'TRANSITION';
      this.holdFrameCount = 0;
      formFeedback = this.wasAtExtreme ? 'Lower back to start' : 'Raise torso higher';
    }

    return { repIncremented, formFeedback };
  }

  // ── Rep quality assessment ───────────────────────────────
  private assessRepQuality(
    currentIssues: string[],
  ): 'PERFECT' | 'GOOD' | 'PARTIAL' {
    if (this.totalRepCycleFrames === 0) return 'GOOD';

    const goodRatio = this.lastRepGoodFormFrames / this.totalRepCycleFrames;

    if (currentIssues.length === 0 && goodRatio >= 0.85) return 'PERFECT';
    if (goodRatio >= 0.6) return 'GOOD';
    return 'PARTIAL';
  }

  // ── Build state object ───────────────────────────────────
  private buildState(
    angle: number,
    rawAngle: number,
    formFeedback: string,
    isGoodForm: boolean,
    formIssues: string[],
    activeSide: 'left' | 'right',
    leftConfidence: number,
    rightConfidence: number,
  ): ExerciseState {
    return {
      exercise: this.exercise,
      reps: this.reps,
      targetReps: this.targetReps,
      stage: this.stage,
      angle,
      rawAngle,
      formFeedback,
      isGoodForm,
      formIssues,
      leftConfidence,
      rightConfidence,
      activeSide,
      repQuality: this.lastRepQuality,
      consecutiveGoodForm: this.consecutiveGoodForm,
    };
  }
}
