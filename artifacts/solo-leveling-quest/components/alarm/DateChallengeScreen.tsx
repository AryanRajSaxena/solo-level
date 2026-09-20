import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { alarmAudio } from '@/utils/alarmAudio';

interface DateChallengeScreenProps {
  onSuccess: () => void;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const DateChallengeScreen = ({ onSuccess }: DateChallengeScreenProps) => {
  const [inputVal, setInputVal] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState(false);

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

  const validateDate = (input: string): boolean => {
    const trimmed = input.trim();
    const today = new Date();
    const day = today.getDate();
    const monthIndex = today.getMonth();
    const monthName = MONTH_NAMES[monthIndex];
    const year = today.getFullYear();

    // Regex to parse "DD MMMM YYYY" or "D MMMM YYYY"
    const parts = trimmed.split(/\s+/);
    if (parts.length !== 3) return false;

    const [inputDay, inputMonth, inputYear] = parts;
    const parsedDay = parseInt(inputDay, 10);
    const parsedYear = parseInt(inputYear, 10);

    if (isNaN(parsedDay) || isNaN(parsedYear)) return false;
    if (parsedDay !== day || parsedYear !== year) return false;
    if (inputMonth.toLowerCase() !== monthName.toLowerCase()) return false;

    return true;
  };

  const handleConfirm = () => {
    if (validateDate(inputVal)) {
      alarmAudio.playCorrectSound();
      setErrorMessage(null);
      setSuccessNotice(true);
      setTimeout(() => {
        onSuccess();
      }, 800);
    } else {
      alarmAudio.playWrongSound();
      setErrorMessage('[Error] Incorrect date. The System knows what day it is.');
      triggerShake();
      setInputVal('');
    }
  };

  return (
    <View style={styles.container}>
      {/* System Trial Eyebrow */}
      <View style={styles.systemBox}>
        <Text style={styles.trialTitle}>
          [System] Trial 3 of 4 — Identity Verification
        </Text>
      </View>

      {/* Date Instruction Card */}
      <Animated.View style={[styles.card, animatedShakeStyle]}>
        <Text style={styles.instruction}>
          Enter today's date in full: DD Month YYYY
        </Text>
        <Text style={styles.exampleText}>
          e.g. 14 March 2025
        </Text>

        {/* Text Input with Gold Underline (No Box Border) */}
        <TextInput
          value={inputVal}
          onChangeText={(val) => {
            setInputVal(val);
            if (errorMessage) setErrorMessage(null);
          }}
          placeholder="Type today's date..."
          placeholderTextColor="rgba(255, 255, 255, 0.3)"
          style={styles.goldUnderlineInput}
          autoCapitalize="words"
          autoCorrect={false}
          editable={!successNotice}
        />

        {/* Error / Success Notice */}
        {successNotice ? (
          <Text style={styles.successText}>[System] Identity confirmed.</Text>
        ) : errorMessage ? (
          <Text style={styles.errorText}>{errorMessage}</Text>
        ) : (
          <Text style={styles.formatHint}>Full month name required · No abbreviations</Text>
        )}
      </Animated.View>

      {/* Action Button */}
      <View style={styles.actionSection}>
        <TouchableOpacity
          activeOpacity={0.8}
          style={[styles.confirmBtn, (!inputVal.trim() || successNotice) && styles.confirmBtnDisabled]}
          disabled={!inputVal.trim() || successNotice}
          onPress={handleConfirm}
        >
          <Text style={styles.confirmBtnText}>CONFIRM</Text>
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
  card: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderRadius: 14,
    backgroundColor: 'rgba(11, 15, 25, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255, 178, 92, 0.25)',
  },
  instruction: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  exampleText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.4)',
    marginBottom: 20,
  },
  goldUnderlineInput: {
    width: '100%',
    fontSize: 20,
    fontWeight: '700',
    color: '#ffb25c',
    textAlign: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#ffb25c',
    letterSpacing: 1,
  },
  errorText: {
    color: '#ff2a55',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: 12,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  successText: {
    color: '#00e5ff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 12,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  formatHint: {
    color: 'rgba(255, 255, 255, 0.35)',
    fontSize: 10,
    letterSpacing: 0.5,
    marginTop: 12,
    textAlign: 'center',
  },
  actionSection: {
    width: '100%',
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
  },
  confirmBtn: {
    height: 52,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#ffb25c',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnDisabled: {
    opacity: 0.35,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  confirmBtnText: {
    color: '#ffb25c',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 2,
  },
});

