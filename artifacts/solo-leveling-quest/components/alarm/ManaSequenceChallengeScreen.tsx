import React, { useState, useCallback } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { NumericKeypad } from './NumericKeypad';
import { alarmAudio } from '@/utils/alarmAudio';

interface ManaSequenceChallengeScreenProps {
  onSuccess: () => void;
}

function generateSequence(length = 5): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += Math.floor(Math.random() * 9 + 1).toString();
  }
  return result;
}

export const ManaSequenceChallengeScreen = ({ onSuccess }: ManaSequenceChallengeScreenProps) => {
  const [targetSequence, setTargetSequence] = useState<string>(() => generateSequence(5));
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
    if (inputVal.length < 5) {
      const next = inputVal + d;
      setInputVal(next);
      if (errorMessage) setErrorMessage(null);

      // Auto-validate once 5 digits are entered
      if (next.length === 5) {
        if (next === targetSequence) {
          alarmAudio.playCorrectSound();
          onSuccess();
        } else {
          alarmAudio.playWrongSound();
          setErrorMessage('[Error] Mana frequency destabilized. Recalibrating...');
          triggerShake();
          setInputVal('');
          setTargetSequence(generateSequence(5));
        }
      }
    }
  };

  const handleDelete = () => {
    setInputVal((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setInputVal('');
  };

  return (
    <View style={styles.container}>
      {/* System Trial Eyebrow */}
      <View style={styles.systemBox}>
        <Text style={styles.trialTitle}>
          [System] Trial 2 of 4 — Mana Resonance Calibration
        </Text>
      </View>

      {/* Target Sequence Display */}
      <Animated.View style={[styles.sequenceCard, animatedShakeStyle]}>
        <Text style={styles.sequenceInstruction}>TARGET MANA FREQUENCY</Text>
        <View style={styles.codeRow}>
          {targetSequence.split('').map((char, index) => (
            <View key={index} style={styles.runeCell}>
              <Text style={styles.runeText}>{char}</Text>
            </View>
          ))}
        </View>

        {/* User Input Display */}
        <View style={styles.inputContainer}>
          <View style={styles.inputRow}>
            {Array.from({ length: 5 }).map((_, idx) => {
              const enteredChar = inputVal[idx];
              return (
                <View
                  key={idx}
                  style={[
                    styles.inputCell,
                    enteredChar ? styles.inputCellFilled : null,
                  ]}
                >
                  <Text style={styles.enteredCharText}>{enteredChar || '·'}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Error Notice */}
        {errorMessage ? (
          <Text style={styles.errorText}>{errorMessage}</Text>
        ) : (
          <Text style={styles.hintText}>Key in the 5-digit mana resonance code in exact sequence</Text>
        )}
      </Animated.View>

      {/* Numeric Keypad */}
      <View style={styles.keypadSection}>
        <NumericKeypad
          onPressDigit={handleDigit}
          onPressDelete={handleDelete}
          onPressClear={handleClear}
        />
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
    borderColor: 'rgba(0, 229, 255, 0.4)',
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
    borderRadius: 8,
    alignSelf: 'center',
    marginBottom: 12,
  },
  trialTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#00e5ff',
    letterSpacing: 1.2,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  sequenceCard: {
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(11, 15, 25, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.25)',
  },
  sequenceInstruction: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(0, 229, 255, 0.8)',
    letterSpacing: 2,
    marginBottom: 12,
  },
  codeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  runeCell: {
    width: 44,
    height: 52,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#00e5ff',
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  runeText: {
    fontSize: 26,
    fontWeight: '800',
    color: '#ffffff',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  inputContainer: {
    marginVertical: 10,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  inputCell: {
    width: 44,
    height: 48,
    borderRadius: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  inputCellFilled: {
    borderBottomColor: '#ffb25c',
    backgroundColor: 'rgba(255, 178, 92, 0.1)',
  },
  enteredCharText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffb25c',
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
  },
});

