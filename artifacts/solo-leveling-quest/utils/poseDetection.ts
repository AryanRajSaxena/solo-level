/**
 * poseDetection.ts
 *
 * Google MediaPipe / BlazePose Pose Landmarker on-device AI integration.
 * Calculates real-time 3D joint angles and implements biomechanical state machines
 * for counting Push-ups and Sit-ups with form validation.
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
  angle: number; // Current primary joint angle in degrees
  formFeedback: string;
  isGoodForm: boolean;
  leftConfidence: number;
  rightConfidence: number;
  activeSide: 'left' | 'right';
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

export class PoseEvaluator {
  private exercise: ExerciseType;
  private targetReps: number;
  private reps: number = 0;
  private stage: 'UP' | 'DOWN' | 'TRANSITION' | 'CALIBRATING' = 'CALIBRATING';
  private wasDown: boolean = false;
  private lastRepTimestamp: number = 0;

  constructor(exercise: ExerciseType, targetReps: number = 20) {
    this.exercise = exercise;
    this.targetReps = targetReps;
  }

  public reset(targetReps?: number) {
    this.reps = 0;
    this.stage = 'CALIBRATING';
    this.wasDown = false;
    this.lastRepTimestamp = 0;
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
    if (!landmarks || landmarks.length < 33) {
      return {
        state: {
          exercise: this.exercise,
          reps: this.reps,
          targetReps: this.targetReps,
          stage: 'CALIBRATING',
          angle: 0,
          formFeedback: 'Position full body in camera frame',
          isGoodForm: false,
          leftConfidence: 0,
          rightConfidence: 0,
          activeSide: 'left',
        },
        repIncremented: false,
      };
    }

    const leftShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
    const rightShoulder = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
    const leftElbow = landmarks[POSE_LANDMARKS.LEFT_ELBOW];
    const rightElbow = landmarks[POSE_LANDMARKS.RIGHT_ELBOW];
    const leftWrist = landmarks[POSE_LANDMARKS.LEFT_WRIST];
    const rightWrist = landmarks[POSE_LANDMARKS.RIGHT_WRIST];
    const leftHip = landmarks[POSE_LANDMARKS.LEFT_HIP];
    const rightHip = landmarks[POSE_LANDMARKS.RIGHT_HIP];
    const leftKnee = landmarks[POSE_LANDMARKS.LEFT_KNEE];
    const rightKnee = landmarks[POSE_LANDMARKS.RIGHT_KNEE];

    // Determine which side is more visible to the camera
    const leftScore =
      (leftShoulder.visibility ?? 1) +
      (leftElbow.visibility ?? 1) +
      (leftWrist.visibility ?? 1) +
      (leftHip.visibility ?? 1);
    const rightScore =
      (rightShoulder.visibility ?? 1) +
      (rightElbow.visibility ?? 1) +
      (rightWrist.visibility ?? 1) +
      (rightHip.visibility ?? 1);

    const activeSide: 'left' | 'right' = leftScore >= rightScore ? 'left' : 'right';

    let repIncremented = false;
    let angle = 0;
    let formFeedback = '';
    let isGoodForm = true;

    const now = Date.now();

    if (this.exercise === 'pushups') {
      // Push-up Biomechanics:
      // Primary angle: Elbow angle (Shoulder - Elbow - Wrist)
      const shoulder = activeSide === 'left' ? leftShoulder : rightShoulder;
      const elbow = activeSide === 'left' ? leftElbow : rightElbow;
      const wrist = activeSide === 'left' ? leftWrist : rightWrist;
      const hip = activeSide === 'left' ? leftHip : rightHip;

      angle = calculateAngle(shoulder, elbow, wrist);

      // Plank alignment check (Shoulder - Hip - Knee)
      const knee = activeSide === 'left' ? leftKnee : rightKnee;
      const bodyAlignmentAngle = calculateAngle(shoulder, hip, knee);

      if (bodyAlignmentAngle < 140) {
        formFeedback = 'Keep your back and hips straight!';
        isGoodForm = false;
      } else if (angle > 155) {
        // Upper position (arms extended)
        if (this.wasDown && now - this.lastRepTimestamp > 800) {
          // Valid rep completed!
          this.reps += 1;
          this.wasDown = false;
          this.lastRepTimestamp = now;
          repIncremented = true;
          formFeedback = 'Excellent rep!';
        } else {
          formFeedback = 'Lower your chest down to 90°';
        }
        this.stage = 'UP';
      } else if (angle < 90) {
        // Lower position (chest lowered)
        this.wasDown = true;
        this.stage = 'DOWN';
        formFeedback = 'Good depth! Now push back up';
      } else {
        this.stage = 'TRANSITION';
        if (!this.wasDown) {
          formFeedback = 'Lower further down';
        } else {
          formFeedback = 'Push fully to top';
        }
      }
    } else {
      // Sit-up Biomechanics:
      // Primary angle: Hip angle (Shoulder - Hip - Knee)
      const shoulder = activeSide === 'left' ? leftShoulder : rightShoulder;
      const hip = activeSide === 'left' ? leftHip : rightHip;
      const knee = activeSide === 'left' ? leftKnee : rightKnee;

      angle = calculateAngle(shoulder, hip, knee);

      if (angle > 130) {
        // Lying down / starting position
        if (this.wasDown && now - this.lastRepTimestamp > 800) {
          // Completed return
          this.reps += 1;
          this.wasDown = false;
          this.lastRepTimestamp = now;
          repIncremented = true;
          formFeedback = 'Rep counted! Raise torso again';
        } else {
          formFeedback = 'Contract core and raise torso';
        }
        this.stage = 'DOWN';
      } else if (angle < 75) {
        // Peak flexion (raised up towards knees)
        this.wasDown = true;
        this.stage = 'UP';
        formFeedback = 'Peak contraction! Now lower smoothly';
      } else {
        this.stage = 'TRANSITION';
        formFeedback = this.wasDown ? 'Lower back down' : 'Raise torso higher';
      }
    }

    return {
      state: {
        exercise: this.exercise,
        reps: this.reps,
        targetReps: this.targetReps,
        stage: this.stage,
        angle,
        formFeedback,
        isGoodForm,
        leftConfidence: leftScore / 4,
        rightConfidence: rightScore / 4,
        activeSide,
      },
      repIncremented,
    };
  }
}
