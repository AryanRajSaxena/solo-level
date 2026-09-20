/**
 * assessmentEvaluation.ts
 *
 * Evaluates the Hunter's Awakening Rank Assessment based on AI-tracked Push-ups and Sit-ups.
 * Determines initial Hunter Rank, starting Level, primary attributes, and title.
 */

export interface AssessmentResult {
  pushupsReps: number;
  situpsReps: number;
  totalReps: number;
  rank: 'E' | 'D' | 'C' | 'B' | 'A' | 'S';
  level: number;
  title: string;
  stats: {
    STR: number;
    INT: number;
    STAMINA: number;
    DISCIPLINE: number;
  };
  evaluationSummary: string;
}

export function evaluateHunterAssessment(pushups: number, situps: number): AssessmentResult {
  const total = pushups + situps;

  if (total >= 95) {
    return {
      pushupsReps: pushups,
      situpsReps: situps,
      totalReps: total,
      rank: 'S',
      level: 50,
      title: 'Shadow Monarch Candidate',
      stats: { STR: 50, INT: 40, STAMINA: 50, DISCIPLINE: 45 },
      evaluationSummary: 'EXTRAORDINARY MANA DENSITY DETECTED. S-RANK CLASSIFICATION CONFIRMED.',
    };
  } else if (total >= 75) {
    return {
      pushupsReps: pushups,
      situpsReps: situps,
      totalReps: total,
      rank: 'A',
      level: 35,
      title: 'High-Rank Vanguard',
      stats: { STR: 35, INT: 30, STAMINA: 35, DISCIPLINE: 30 },
      evaluationSummary: 'HIGH-TIER COMBAT PHYSIQUE CONFIRMED. A-RANK CLASSIFICATION CONFIRMED.',
    };
  } else if (total >= 55) {
    return {
      pushupsReps: pushups,
      situpsReps: situps,
      totalReps: total,
      rank: 'B',
      level: 25,
      title: 'Elite Raid Hunter',
      stats: { STR: 25, INT: 20, STAMINA: 25, DISCIPLINE: 20 },
      evaluationSummary: 'EXCELLENT PHYSICAL RESILIENCE. B-RANK CLASSIFICATION CONFIRMED.',
    };
  } else if (total >= 35) {
    return {
      pushupsReps: pushups,
      situpsReps: situps,
      totalReps: total,
      rank: 'C',
      level: 15,
      title: 'Dungeon Striker',
      stats: { STR: 15, INT: 15, STAMINA: 15, DISCIPLINE: 15 },
      evaluationSummary: 'SOLID COMBAT POTENTIAL. C-RANK CLASSIFICATION CONFIRMED.',
    };
  } else if (total >= 15) {
    return {
      pushupsReps: pushups,
      situpsReps: situps,
      totalReps: total,
      rank: 'D',
      level: 8,
      title: 'Awakened Warrior',
      stats: { STR: 8, INT: 5, STAMINA: 8, DISCIPLINE: 5 },
      evaluationSummary: 'INITIAL AWAKENING CONFIRMED. D-RANK CLASSIFICATION ASSIGNED.',
    };
  } else {
    return {
      pushupsReps: pushups,
      situpsReps: situps,
      totalReps: total,
      rank: 'E',
      level: 1,
      title: 'E-Rank Hunter',
      stats: { STR: 1, INT: 1, STAMINA: 1, DISCIPLINE: 1 },
      evaluationSummary: 'BASELINE HUNTER PROFILE. EVOLVE THROUGH DAILY PROTOCOLS.',
    };
  }
}

