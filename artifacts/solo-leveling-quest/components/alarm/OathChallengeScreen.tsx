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

interface OathChallengeScreenProps {
  onSuccess: () => void;
}

const REQUIRED_OATH = 'get up you have no choice';

export const OathChallengeScreen = ({ onSuccess }: OathChallengeScreenProps) => {
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

  const handleConfirm = () => {
    const cleanedInput = inputVal.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
    if (cleanedInput === REQUIRED_OATH) {
      alarmAudio.playCorrectSound();
      onSuccess();
    } else {
      alarmAudio.playWrongSound();
      setErrorMessage('[Error] Oath incomplete. Type every word.');
      triggerShake();
      setInputVal('');
    }
  };

  return (
    <View style={styles.container}>
      {/* System Trial Eyebrow */}
      <View style={styles.systemBox}>
        <Text style={styles.trialTitle}>
          [System] Trial 4 of 4 — Hunter's Oath
        </Text>
      </View>

      {/* Oath Instruction Card */}
      <Animated.View style={[styles.card, animatedShakeStyle]}>
        <View style={styles.promptBox}>
          <Text style={styles.promptText}>
            [System] Recite the Hunter's Oath to proceed.
          </Text>
        </View>

        {/* The Oath in Large Gold Serif Text */}
        <View style={styles.oathQuoteBox}>
          <Text style={styles.oathQuoteText}>
            "Get up.{'\n'}You have no choice."
          </Text>
        </View>

        {/* Text Input */}
        <TextInput
          value={inputVal}
          onChangeText={(val) => {
            setInputVal(val);
            if (errorMessage) setErrorMessage(null);
          }}
          placeholder="Type the oath exactly..."
          placeholderTextColor="rgba(255, 255, 255, 0.3)"
          style={styles.textInput}
          autoCapitalize="none"
          autoCorrect={false}
        />

        {/* Error Notice */}
        {errorMessage ? (
          <Text style={styles.errorText}>{errorMessage}</Text>
        ) : (
          <Text style={styles.hintText}>Final trial · Type every word to silence the System</Text>
        )}
      </Animated.View>

      {/* Action Button: Solid Gold Fill with Dark Text */}
      <View style={styles.actionSection}>
        <TouchableOpacity
          activeOpacity={0.85}
          style={[styles.confirmBtnFilled, !inputVal.trim() && styles.confirmBtnDisabled]}
          disabled={!inputVal.trim()}
          onPress={handleConfirm}
        >
          <Text style={styles.confirmBtnFilledText}>CONFIRM OATH</Text>
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
    paddingVertical: 20,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: 'rgba(11, 15, 25, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255, 178, 92, 0.25)',
  },
  promptBox: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
    backgroundColor: 'rgba(0, 229, 255, 0.06)',
    borderRadius: 6,
    marginBottom: 16,
  },
  promptText: {
    fontSize: 11,
    color: '#00e5ff',
    fontWeight: '700',
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  oathQuoteBox: {
    marginVertical: 10,
    paddingHorizontal: 12,
  },
  oathQuoteText: {
    fontSize: 32,
    fontWeight: '800',
    color: '#ffb25c',
    textAlign: 'center',
    lineHeight: 40,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  textInput: {
    width: '100%',
    fontSize: 16,
    color: '#ffffff',
    textAlign: 'center',
    paddingVertical: 12,
    marginTop: 16,
    borderBottomWidth: 2,
    borderBottomColor: '#ffb25c',
    letterSpacing: 0.5,
  },
  errorText: {
    color: '#ff2a55',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: 10,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  hintText: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 10,
    letterSpacing: 0.5,
    marginTop: 10,
    textAlign: 'center',
  },
  actionSection: {
    width: '100%',
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
  },
  confirmBtnFilled: {
    height: 52,
    borderRadius: 10,
    backgroundColor: '#ffb25c',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ffb25c',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
  },
  confirmBtnDisabled: {
    opacity: 0.35,
    backgroundColor: 'rgba(255, 178, 92, 0.4)',
    shadowOpacity: 0,
  },
  confirmBtnFilledText: {
    color: '#070b13',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 2,
  },
});

