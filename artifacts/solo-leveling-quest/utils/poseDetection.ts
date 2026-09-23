/**
 * poseDetection.ts — FIXED
 *
 * Changes from original:
 *  1. calculateAngle3D() — 3D dot-product replaces 2D atan2 (fixes front-camera accuracy)
 *  2. PUSHUP_UP_ENTER lowered 160° → 145° (THE main rep-counting fix)
 *  3. PUSHUP_DOWN_ENTER raised 85° → 90° (more permissive)
 *  4. True hysteresis: separate ENTER/EXIT thresholds per phase (fixes holdFrameCount reset bug)
 *  5. MIN_REP_INTERVAL_MS reduced 1200 → 800 (allows moderate-paced push-ups)
 *  6. PUSHUP_PLANK_MIN lowered 155° → 145° (reduces false form feedback)
 *  7. Elbow flare check removed (was only valid for front-view camera, false positives on side view)
 *  8. confirmedDown / confirmedUp state added for hysteresis (new class properties)
 */

export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export type ExerciseType = 'pushups' | 'situps';

export interface ExerciseState {
  exercise: ExerciseType;
  reps: number;
  targetReps: number;
  stage: 'UP' | 'DOWN' | 'TRANSITION' | 'CALIBRATING';
  angle: number;
  rawAngle: number;
  formFeedback: string;
  isGoodForm: boolean;
  formIssues: string[];
  leftConfidence: number;
  rightConfidence: number;
  activeSide: 'left' | 'right';
  repQuality: 'PERFECT' | 'GOOD' | 'PARTIAL' | null;
  consecutiveGoodForm: number;
}

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

export const POSE_CONNECTIONS: [number, number][] = [
  [POSE_LANDMARKS.LEFT_SHOULDER, POSE_LANDMARKS.RIGHT_SHOULDER],
  [POSE_LANDMARKS.LEFT_SHOULDER, POSE_LANDMARKS.LEFT_HIP],
  [POSE_LANDMARKS.RIGHT_SHOULDER, POSE_LANDMARKS.RIGHT_HIP],
  [POSE_LANDMARKS.LEFT_HIP, POSE_LANDMARKS.RIGHT_HIP],
  [POSE_LANDMARKS.LEFT_SHOULDER, POSE_LANDMARKS.LEFT_ELBOW],
  [POSE_LANDMARKS.LEFT_ELBOW, POSE_LANDMARKS.LEFT_WRIST],
  [POSE_LANDMARKS.RIGHT_SHOULDER, POSE_LANDMARKS.RIGHT_ELBOW],
  [POSE_LANDMARKS.RIGHT_ELBOW, POSE_LANDMARKS.RIGHT_WRIST],
  [POSE_LANDMARKS.LEFT_HIP, POSE_LANDMARKS.LEFT_KNEE],
  [POSE_LANDMARKS.LEFT_KNEE, POSE_LANDMARKS.LEFT_ANKLE],
  [POSE_LANDMARKS.RIGHT_HIP, POSE_LANDMARKS.RIGHT_KNEE],
  [POSE_LANDMARKS.RIGHT_KNEE, POSE_LANDMARKS.RIGHT_ANKLE],
];

// ─── Tunable constants ───────────────────────────────────────

const EMA_ALPHA = 0.35;
const MIN_REP_INTERVAL_MS = 800;      // FIX 5: was 1200 — allows ~1 rep/sec pace
const HOLD_FRAMES_REQUIRED = 3;
const MAX_ANGULAR_VELOCITY = 25;
const CALIBRATION_FRAMES = 15;
const MIN_JOINT_VISIBILITY = 0.5;

// Push-up thresholds — TRUE HYSTERESIS (separate enter vs exit per zone)
// FIX 2: was single threshold per zone, causing holdFrameCount reset oscillation
const PUSHUP_DOWN_ENTER  = 90;    // FIX 3: was 85 — enter DOWN when angle drops below this
const PUSHUP_DOWN_EXIT   = 105;   // NEW — leave DOWN only when angle rises above this
const PUSHUP_UP_ENTER    = 145;   // FIX 1: was 160 — THE main fix, enter UP when above this
const PUSHUP_UP_EXIT     = 130;   // NEW — leave UP only when angle drops below this
const PUSHUP_PLANK_MIN   = 145;   // FIX 6: was 155 — reduces false form feedback

// Sit-up thresholds (unchanged — sit-up tracking was not reported broken)
const SITUP_UP_ENTER  = 70;
const SITUP_DOWN_ENTER = 140;
const SITUP_KNEE_MIN  = 50;
const SITUP_KNEE_MAX  = 110;

// ──────────────────────────────────────────────────────────────

/**
 * Original 2D angle — kept for non-depth-critical calculations (sit-up knee angle, etc.)
 */
export function calculateAngle(a: Landmark, b: Landmark, c: Landmark): number {
  const radians =
    Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs((radians * 180.0) / Math.PI);
  if (angle > 180.0) angle = 360.0 - angle;
  return Math.round(angle);
}

/**
 * FIX 4: 3D angle using dot-product — accurate regardless of camera orientation.
 *
 * The original calculateAngle() used only x and y (Math.atan2(c.y - b.y, c.x - b.x)).
 * For push-ups viewed from the front, arm movement is mostly in the z-depth axis.
 * Ignoring z caused a fully-extended arm to read as ~90° instead of ~160°.
 * This function includes z to get the true anatomical angle at joint B.
 */
export function calculateAngle3D(a: Landmark, b: Landmark, c: Landmark): number {
  // Vectors from vertex B toward each end joint
  const v1 = {
    x: a.x - b.x,
    y: a.y - b.y,
    z: (a.z ?? 0) - (b.z ?? 0),
  };
  const v2 = {
    x: c.x - b.x,
    y: c.y - b.y,
    z: (c.z ?? 0) - (b.z ?? 0),
  };

  const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
  const mag1 = Math.sqrt(v1.x ** 2 + v1.y ** 2 + v1.z ** 2);
  const mag2 = Math.sqrt(v2.x ** 2 + v2.y ** 2 + v2.z ** 2);

  if (mag1 === 0 || mag2 === 0) return 0;

  // Clamp to [-1, 1] to guard against floating-point drift past ±1 in Math.acos
  const cosAngle = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  return Math.round((Math.acos(cosAngle) * 180) / Math.PI);
}

function bilateralAngle(
  leftAngle: number,
  rightAngle: number,
  leftVis: number,
  rightVis: number,
): number {
  const leftOk  = leftVis  >= MIN_JOINT_VISIBILITY;
  const rightOk = rightVis >= MIN_JOINT_VISIBILITY;

  if (leftOk && rightOk) {
    const total = leftVis + rightVis;
    return Math.round((leftAngle * leftVis + rightAngle * rightVis) / total);
  }
  if (leftOk)  return leftAngle;
  if (rightOk) return rightAngle;
  return Math.round((leftAngle + rightAngle) / 2);
}

function avgVisibility(...landmarks: Landmark[]): number {
  const sum = landmarks.reduce((acc, lm) => acc + (lm.visibility ?? 0), 0);
  return sum / landmarks.length;
}

export class PoseEvaluator {
  private exercise: ExerciseType;
  private targetReps: number;
  private reps: number = 0;
  private stage: 'UP' | 'DOWN' | 'TRANSITION' | 'CALIBRATING' = 'CALIBRATING';

  private smoothedAngle: number = 0;
  private previousRawAngle: number = 0;
  private hasSmoothedValue: boolean = false;

  private wasAtExtreme: boolean = false;
  private holdFrameCount: number = 0;
  private lastRepTimestamp: number = 0;

  // FIX 2 — hysteresis: track whether we are confirmed inside each stable zone
  private confirmedDown: boolean = false;
  private confirmedUp: boolean = false;

  private frameCount: number = 0;
  private consecutiveGoodForm: number = 0;
  private lastRepGoodFormFrames: number = 0;
  private totalRepCycleFrames: number = 0;
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
    // FIX 2
    this.confirmedDown = false;
    this.confirmedUp = false;
    if (targetReps !== undefined) this.targetReps = targetReps;
  }

  public evaluateFrame(landmarks: Landmark[]): {
    state: ExerciseState;
    repIncremented: boolean;
  } {
    if (!landmarks || landmarks.length < 33) {
      return {
        state: this.buildState(0, 0, 'Position full body in camera frame', false, [], 'left', 0, 0),
        repIncremented: false,
      };
    }

    this.frameCount++;

    const lShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
    const rShoulder = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
    const lElbow    = landmarks[POSE_LANDMARKS.LEFT_ELBOW];
    const rElbow    = landmarks[POSE_LANDMARKS.RIGHT_ELBOW];
    const lWrist    = landmarks[POSE_LANDMARKS.LEFT_WRIST];
    const rWrist    = landmarks[POSE_LANDMARKS.RIGHT_WRIST];
    const lHip      = landmarks[POSE_LANDMARKS.LEFT_HIP];
    const rHip      = landmarks[POSE_LANDMARKS.RIGHT_HIP];
    const lKnee     = landmarks[POSE_LANDMARKS.LEFT_KNEE];
    const rKnee     = landmarks[POSE_LANDMARKS.RIGHT_KNEE];
    const lAnkle    = landmarks[POSE_LANDMARKS.LEFT_ANKLE];
    const rAnkle    = landmarks[POSE_LANDMARKS.RIGHT_ANKLE];

    const leftArmVis  = avgVisibility(lShoulder, lElbow, lWrist);
    const rightArmVis = avgVisibility(rShoulder, rElbow, rWrist);
    const leftBodyVis = avgVisibility(lShoulder, lHip, lKnee, lAnkle);
    const rightBodyVis = avgVisibility(rShoulder, rHip, rKnee, rAnkle);

    const leftScore  = (leftArmVis + leftBodyVis) / 2;
    const rightScore = (rightArmVis + rightBodyVis) / 2;
    const activeSide: 'left' | 'right' = leftScore >= rightScore ? 'left' : 'right';

    const keyJointVis = this.exercise === 'pushups'
      ? [
          activeSide === 'left' ? lShoulder : rShoulder,
          activeSide === 'left' ? lElbow    : rElbow,
          activeSide === 'left' ? lWrist    : rWrist,
          activeSide === 'left' ? lHip      : rHip,
        ]
      : [
          activeSide === 'left' ? lShoulder : rShoulder,
          activeSide === 'left' ? lHip      : rHip,
          activeSide === 'left' ? lKnee     : rKnee,
          activeSide === 'left' ? lAnkle    : rAnkle,
        ];

    const visibleJointCount = keyJointVis.filter(
      (lm) => (lm.visibility ?? 0) > MIN_JOINT_VISIBILITY,
    ).length;

    if (visibleJointCount < 3) {
      return {
        state: this.buildState(
          this.smoothedAngle, 0,
          'Move closer or adjust angle — key joints not visible',
          false, ['Low visibility'], activeSide, leftScore, rightScore,
        ),
        repIncremented: false,
      };
    }

    const formIssues: string[] = [];

    let rawAngle: number;

    if (this.exercise === 'pushups') {
      rawAngle = this.computePushupAngle(
        lShoulder, rShoulder, lElbow, rElbow, lWrist, rWrist,
        leftArmVis, rightArmVis,
      );
      this.validatePushupForm(
        lShoulder, rShoulder, lHip, rHip, lAnkle, rAnkle,
        leftBodyVis, rightBodyVis, formIssues,
      );
    } else {
      rawAngle = this.computeSitupAngle(
        lShoulder, rShoulder, lHip, rHip, lKnee, rKnee,
        leftBodyVis, rightBodyVis,
      );
      this.validateSitupForm(
        lHip, rHip, lKnee, rKnee, lAnkle, rAnkle,
        lShoulder, rShoulder,
        activeSide, leftBodyVis, rightBodyVis, formIssues,
      );
    }

    const isGoodForm = formIssues.length === 0;

    const angularDelta = Math.abs(rawAngle - this.previousRawAngle);
    const velocityExceeded =
      this.hasSmoothedValue && angularDelta > MAX_ANGULAR_VELOCITY;
    this.previousRawAngle = rawAngle;

    if (!this.hasSmoothedValue) {
      this.smoothedAngle = rawAngle;
      this.hasSmoothedValue = true;
    } else {
      this.smoothedAngle = Math.round(
        EMA_ALPHA * rawAngle + (1 - EMA_ALPHA) * this.smoothedAngle,
      );
    }

    const angle = this.smoothedAngle;

    if (this.frameCount <= CALIBRATION_FRAMES) {
      this.stage = 'CALIBRATING';
      const remaining = CALIBRATION_FRAMES - this.frameCount;
      return {
        state: this.buildState(
          angle, rawAngle,
          `Calibrating... hold position (${remaining})`,
          true, [], activeSide, leftScore, rightScore,
        ),
        repIncremented: false,
      };
    }

    this.totalRepCycleFrames++;
    if (isGoodForm) {
      this.consecutiveGoodForm++;
      this.lastRepGoodFormFrames++;
    } else {
      this.consecutiveGoodForm = 0;
    }

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

  // FIX 4: Use calculateAngle3D for elbow angle (accurate for any camera angle)
  private computePushupAngle(
    lShoulder: Landmark, rShoulder: Landmark,
    lElbow: Landmark, rElbow: Landmark,
    lWrist: Landmark, rWrist: Landmark,
    leftVis: number, rightVis: number,
  ): number {
    const leftAngle  = calculateAngle3D(lShoulder, lElbow, lWrist);
    const rightAngle = calculateAngle3D(rShoulder, rElbow, rWrist);
    return bilateralAngle(leftAngle, rightAngle, leftVis, rightVis);
  }

  private computeSitupAngle(
    lShoulder: Landmark, rShoulder: Landmark,
    lHip: Landmark, rHip: Landmark,
    lKnee: Landmark, rKnee: Landmark,
    leftVis: number, rightVis: number,
  ): number {
    const leftAngle  = calculateAngle(lShoulder, lHip, lKnee);
    const rightAngle = calculateAngle(rShoulder, rHip, rKnee);
    return bilateralAngle(leftAngle, rightAngle, leftVis, rightVis);
  }

  // FIX 7: Removed the elbow flare check (shoulder.x vs wrist.x).
  // It was only meaningful for front-view cameras — for any side-view camera it
  // always fired as "Hands too wide" even with perfect form.
  private validatePushupForm(
    lShoulder: Landmark, rShoulder: Landmark,
    lHip: Landmark, rHip: Landmark,
    lAnkle: Landmark, rAnkle: Landmark,
    leftBodyVis: number, rightBodyVis: number,
    issues: string[],
  ): void {
    // Plank alignment: Shoulder → Hip → Ankle
    // FIX 6: threshold lowered from 155 to 145
    const leftPlank  = calculateAngle(lShoulder, lHip, lAnkle);
    const rightPlank = calculateAngle(rShoulder, rHip, rAnkle);
    const plankAngle = bilateralAngle(leftPlank, rightPlank, leftBodyVis, rightBodyVis);

    if (plankAngle < PUSHUP_PLANK_MIN) {
      issues.push(plankAngle < 120 ? 'Hips sagging — tighten core!' : 'Keep hips level with shoulders');
    }
  }

  private validateSitupForm(
    lHip: Landmark, rHip: Landmark,
    lKnee: Landmark, rKnee: Landmark,
    lAnkle: Landmark, rAnkle: Landmark,
    lShoulder: Landmark, rShoulder: Landmark,
    activeSide: 'left' | 'right',
    leftBodyVis: number, rightBodyVis: number,
    issues: string[],
  ): void {
    const leftKneeAngle  = calculateAngle(lHip, lKnee, lAnkle);
    const rightKneeAngle = calculateAngle(rHip, rKnee, rAnkle);
    const kneeAngle = bilateralAngle(leftKneeAngle, rightKneeAngle, leftBodyVis, rightBodyVis);

    if (kneeAngle < SITUP_KNEE_MIN) {
      issues.push('Legs too tucked — extend slightly');
    } else if (kneeAngle > SITUP_KNEE_MAX) {
      issues.push('Bend knees more — feet flat on floor');
    }

    const shoulder = activeSide === 'left' ? lShoulder : rShoulder;
    const hip      = activeSide === 'left' ? lHip      : rHip;
    if (this.stage === 'UP' && shoulder.y >= hip.y - 0.02) {
      issues.push('Raise torso higher toward knees');
    }
  }

  /**
   * FIX 1 + 2 + 3: Push-up state machine with true hysteresis.
   *
   * Original problem: single threshold per zone meant that if the smoothed angle
   * bounced around 85° (e.g. 83→87→82→88), the state alternated DOWN↔TRANSITION
   * on every frame, holdFrameCount reset to 0 each time TRANSITION was entered,
   * wasAtExtreme was never set, and reps were never counted.
   *
   * Fix: confirmedDown / confirmedUp only change state when the angle clearly
   * crosses the OPPOSITE threshold (enter at 90, exit only once past 105).
   * This creates a dead-band that absorbs EMA jitter around the boundary.
   */
  private evaluatePushupState(
    angle: number,
    now: number,
    velocityExceeded: boolean,
    formIssues: string[],
  ): { repIncremented: boolean; formFeedback: string } {
    let repIncremented = false;
    let formFeedback = '';

    // ── Update hysteresis flags ────────────────────────────
    if (!this.confirmedDown && angle <= PUSHUP_DOWN_ENTER) {
      this.confirmedDown = true;
    } else if (this.confirmedDown && angle >= PUSHUP_DOWN_EXIT) {
      this.confirmedDown = false;
    }

    if (!this.confirmedUp && angle >= PUSHUP_UP_ENTER) {
      this.confirmedUp = true;
    } else if (this.confirmedUp && angle <= PUSHUP_UP_EXIT) {
      this.confirmedUp = false;
    }

    // ── State machine ──────────────────────────────────────
    if (this.confirmedDown) {
      // ── DOWN zone ──
      this.holdFrameCount++;
      this.stage = 'DOWN';
      // confirmedUp cannot be true simultaneously (angles can't be both
      // above 145 and below 90 at the same time), but clear it defensively
      this.confirmedUp = false;

      if (this.holdFrameCount >= HOLD_FRAMES_REQUIRED) {
        this.wasAtExtreme = true;
        formFeedback = 'Good depth! Push back up';
      } else {
        formFeedback = 'Hold at bottom...';
      }

    } else if (this.confirmedUp) {
      // ── UP zone ──
      this.stage = 'UP';

      if (
        this.wasAtExtreme &&
        !velocityExceeded &&
        now - this.lastRepTimestamp > MIN_REP_INTERVAL_MS
      ) {
        // ── Valid rep ──
        this.reps++;
        repIncremented = true;
        this.lastRepTimestamp = now;
        this.wasAtExtreme = false;
        this.holdFrameCount = 0;

        this.lastRepQuality = this.assessRepQuality(formIssues);
        this.lastRepGoodFormFrames = 0;
        this.totalRepCycleFrames = 0;

        formFeedback =
          this.lastRepQuality === 'PERFECT' ? 'Perfect rep!'  :
          this.lastRepQuality === 'GOOD'    ? 'Good rep!'     :
          'Rep counted — improve form';

      } else if (this.wasAtExtreme && velocityExceeded) {
        formFeedback = 'Too fast — controlled movement only';
      } else if (this.wasAtExtreme) {
        // Waiting to confirm not-too-fast on next frame
        formFeedback = 'Hold at top...';
      } else {
        formFeedback = 'Lower chest toward the floor';
      }

    } else {
      // ── Transition zone ──
      this.stage = 'TRANSITION';
      // Only reset holdFrameCount here — NOT wasAtExtreme.
      // wasAtExtreme must survive through TRANSITION so the rep can be counted
      // when the UP zone is entered.
      this.holdFrameCount = 0;

      if (!this.wasAtExtreme) {
        formFeedback = 'Lower chest further down';
      } else {
        formFeedback = 'Push arms to full extension';
      }
    }

    return { repIncremented, formFeedback };
  }

  // Sit-up state machine — unchanged from original (not reported broken)
  private evaluateSitupState(
    angle: number,
    now: number,
    velocityExceeded: boolean,
    formIssues: string[],
  ): { repIncremented: boolean; formFeedback: string } {
    let repIncremented = false;
    let formFeedback = '';

    if (angle < SITUP_UP_ENTER) {
      this.holdFrameCount++;
      this.stage = 'UP';

      if (this.holdFrameCount >= HOLD_FRAMES_REQUIRED) {
        this.wasAtExtreme = true;
        formFeedback = 'Peak contraction! Lower smoothly';
      } else {
        formFeedback = 'Hold at the top...';
      }
    } else if (angle > SITUP_DOWN_ENTER) {
      this.stage = 'DOWN';

      if (
        this.wasAtExtreme &&
        !velocityExceeded &&
        now - this.lastRepTimestamp > MIN_REP_INTERVAL_MS
      ) {
        this.reps++;
        repIncremented = true;
        this.lastRepTimestamp = now;
        this.wasAtExtreme = false;
        this.holdFrameCount = 0;

        this.lastRepQuality = this.assessRepQuality(formIssues);
        this.lastRepGoodFormFrames = 0;
        this.totalRepCycleFrames = 0;

        formFeedback =
          this.lastRepQuality === 'PERFECT' ? 'Perfect rep!'  :
          this.lastRepQuality === 'GOOD'    ? 'Good rep!'     :
          'Rep counted — improve form';
      } else if (this.wasAtExtreme && velocityExceeded) {
        formFeedback = 'Too fast — use controlled motion';
      } else {
        formFeedback = 'Crunch up toward your knees';
      }
    } else {
      this.stage = 'TRANSITION';
      this.holdFrameCount = 0;
      formFeedback = this.wasAtExtreme ? 'Lower back to start' : 'Raise torso higher';
    }

    return { repIncremented, formFeedback };
  }

  private assessRepQuality(currentIssues: string[]): 'PERFECT' | 'GOOD' | 'PARTIAL' {
    if (this.totalRepCycleFrames === 0) return 'GOOD';
    const goodRatio = this.lastRepGoodFormFrames / this.totalRepCycleFrames;
    if (currentIssues.length === 0 && goodRatio >= 0.85) return 'PERFECT';
    if (goodRatio >= 0.6) return 'GOOD';
    return 'PARTIAL';
  }

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