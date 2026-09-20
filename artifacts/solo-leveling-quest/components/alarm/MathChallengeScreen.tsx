import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { NumericKeypad } from './NumericKeypad';
import { alarmAudio } from '@/utils/alarmAudio';

interface MathChallengeScreenProps {
  onSuccess: () => void;
}

type ProblemType = 'A' | 'B' | 'C';

interface MathProblem {
  expression: string;
  answer: number;
  type: ProblemType;
}

function generateRandomProblem(): MathProblem {
  const randType: ProblemType = (['A', 'B', 'C'] as const)[Math.floor(Math.random() * 3)];

  if (randType === 'A') {
    // Type A: (2-digit) × (2-digit) e.g. 47 × 83
    const n1 = Math.floor(Math.random() * 80) + 12; // 12..91
    const n2 = Math.floor(Math.random() * 80) + 12;
    return {
      expression: `${n1} × ${n2}`,
      answer: n1 * n2,
      type: 'A',
    };
  } else if (randType === 'B') {
    // Type B: sum of four 2-digit numbers e.g. 34 + 67 + 28 + 91
    const n1 = Math.floor(Math.random() * 80) + 15;
    const n2 = Math.floor(Math.random() * 80) + 15;
    const n3 = Math.floor(Math.random() * 80) + 15;
    const n4 = Math.floor(Math.random() * 80) + 15;
    return {
      expression: `${n1} + ${n2} + ${n3} + ${n4}`,
      answer: n1 + n2 + n3 + n4,
      type: 'B',
    };
  } else {
    // Type C: (3-digit) − (2-digit) × (1-digit) e.g. 284 − 37 × 6
    const n1 = Math.floor(Math.random() * 500) + 250; // 250..749
    const n2 = Math.floor(Math.random() * 40) + 12; // 12..51
    const n3 = Math.floor(Math.random() * 8) + 2; // 2..9
    return {
      expression: `${n1} − ${n2} × ${n3}`,
      answer: n1 - (n2 * n3),
      type: 'C',
    };
  }
}

export const MathChallengeScreen = ({ onSuccess }: MathChallengeScreenProps) => {
  const [problem, setProblem] = useState<MathProblem>(generateRandomProblem);
  const [inputVal, setInputVal] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const shakeTranslateX = useSharedValue(0);

  const triggerShake = useCallback(() => {
    shakeTranslateX.value = withSequence(
      withTiming(-12, { duration: 60 }),
      withTiming(12, { duration: 60 }),
      withTiming(-8, { duration: 60 }),
      withTiming(8, { duration: 60 }),
      withTiming(0, { duration: 60 })
    );
  }, [shakeTranslateX]);

  const animatedShakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeTranslateX.value }],
  }));

  const handleDigit = (d: string) => {
    if (inputVal.length < 8) {
      setInputVal((prev) => prev + d);
      if (errorMessage) setErrorMessage(null);
    }
  };

  const handleDelete = () => {
    setInputVal((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setInputVal('');
  };

  const handleSubmit = () => {
    const userNumber = parseInt(inputVal, 10);
    if (isNaN(userNumber)) return;

    if (userNumber === problem.answer) {
      alarmAudio.playCorrectSound();
      onSuccess();
    } else {
      alarmAudio.playWrongSound();
      setErrorMessage('[Error] Incorrect. The System does not forgive errors.');
      triggerShake();
      setInputVal('');
      // Regenerate fresh problem on wrong answer
      setProblem(generateRandomProblem());
    }
  };

  return (
    <View style={styles.container}>
      {/* System Trial Eyebrow */}
      <View style={styles.systemBox}>
        <Text style={styles.trialTitle}>
          [System] Trial 1 of 4 — Mental Clarity Test
        </Text>
      </View>

      {/* Problem Display in Large Gold Serif */}
      <Animated.View style={[styles.problemCard, animatedShakeStyle]}>
        <Text style={styles.problemText}>{problem.expression}</Text>
        
        {/* User Input Field */}
        <View style={styles.inputContainer}>
          <Text style={inputVal ? styles.inputText : styles.inputPlaceholder}>
            {inputVal || 'Enter result'}
          </Text>
        </View>

        {/* Error Notice */}
        {errorMessage ? (
          <Text style={styles.errorText}>{errorMessage}</Text>
        ) : (
          <Text style={styles.hintText}>Calculate and enter the exact numerical value</Text>
        )}
      </Animated.View>

      {/* Numeric Keypad */}
      <View style={styles.keypadSection}>
        <NumericKeypad
          onPressDigit={handleDigit}
          onPressDelete={handleDelete}
          onPressClear={handleClear}
        />

        {/* Submit Button */}
        <TouchableOpacity
          activeOpacity={0.8}
          style={[styles.submitBtn, !inputVal && styles.submitBtnDisabled]}
          disabled={!inputVal}
          onPress={handleSubmit}
        >
          <Text style={styles.submitBtnText}>SUBMIT ANSWER</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'space-between',
  },
  systemBox: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 178, 92, 0.4)',
    backgroundColor: 'rgba(255, 178, 92, 0.08)',
    borderRadius: 8,
    alignSelf: 'center',
    marginBottom: 12,
  },
  trialTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffb25c',
    letterSpacing: 1.2,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  problemCard: {
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(11, 15, 25, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255, 178, 92, 0.25)',
  },
  problemText: {
    fontSize: 42,
    fontWeight: '800',
    color: '#ffb25c',
    letterSpacing: 2,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    textAlign: 'center',
    marginVertical: 8,
  },
  inputContainer: {
    minWidth: 180,
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderBottomWidth: 2,
    borderBottomColor: '#ffb25c',
    alignItems: 'center',
    marginVertical: 10,
  },
  inputText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 3,
  },
  inputPlaceholder: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.3)',
    letterSpacing: 1,
  },
  errorText: {
    color: '#ff2a55',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: 6,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  hintText: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 11,
    letterSpacing: 0.5,
    marginTop: 6,
    textAlign: 'center',
  },
  keypadSection: {
    width: '100%',
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    gap: 12,
  },
  submitBtn: {
    height: 52,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#ffb25c',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.35,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  submitBtnText: {
    color: '#ffb25c',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 2,
  },
});
