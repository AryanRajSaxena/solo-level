import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

interface AlarmEnduranceViewProps {
  initialSeconds?: number;
  onEnduranceComplete: () => void;
  onSkipTest?: () => void;
}

export const AlarmEnduranceView = ({
  initialSeconds = 30,
  onEnduranceComplete,
  onSkipTest,
}: AlarmEnduranceViewProps) => {
  const [secondsRemaining, setSecondsRemaining] = useState(initialSeconds);

  const pulseScale = useSharedValue(1);
  const ringOpacity = useSharedValue(0.4);

  useEffect(() => {
    pulseScale.value = withRepeat(
      withTiming(1.12, { duration: 700, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    ringOpacity.value = withRepeat(
      withTiming(0.9, { duration: 700, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [pulseScale, ringOpacity]);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onEnduranceComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onEnduranceComplete]);

  const animatedRuneStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const animatedRingStyle = useAnimatedStyle(() => ({
    opacity: ringOpacity.value,
  }));

  const formatTimer = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      {/* System Warning Badge */}
      <View style={styles.warningCard}>
        <View style={styles.warningRow}>
          <Feather name="alert-triangle" size={18} color="#ff2a55" />
          <Text style={styles.warningHeader}>[System] Emergency Wake Protocol Activated</Text>
        </View>
        <Text style={styles.warningCountdown}>
          Challenges unlock in: {formatTimer(secondsRemaining)}...
        </Text>
      </View>

      {/* Pulsing Alarm Beacon */}
      <View style={styles.beaconContainer}>
        <Animated.View style={[styles.outerRing, animatedRingStyle]} />
        <Animated.View style={[styles.innerBeacon, animatedRuneStyle]}>
          <Feather name="bell" size={48} color="#ff2a55" />
          <Text style={styles.endureText}>ENDURE</Text>
        </Animated.View>
      </View>

      {/* Protocol Instructions */}
      <View style={styles.instructionBox}>
        <Text style={styles.instructionTitle}>MANDATORY PROTOCOL INITIALIZING</Text>
        <Text style={styles.instructionDetail}>
          Endure the wake frequency. When the countdown completes, 4 cognitive trials will activate in sequence to evaluate your consciousness.
        </Text>
      </View>

      {/* Test Skip Button for quick testing */}
      {onSkipTest && (
        <TouchableOpacity style={styles.skipBtn} onPress={onSkipTest} activeOpacity={0.7}>
          <Text style={styles.skipBtnText}>SKIP 30s WAIT (TEST MODE)</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  warningCard: {
    width: '100%',
    backgroundColor: 'rgba(255, 42, 85, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 42, 85, 0.45)',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#ff2a55',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  warningHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ff2a55',
    letterSpacing: 1.2,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  warningCountdown: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffb4c2',
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  beaconContainer: {
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
  },
  outerRing: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 2,
    borderColor: 'rgba(255, 42, 85, 0.35)',
    backgroundColor: 'rgba(255, 42, 85, 0.05)',
  },
  innerBeacon: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    borderColor: '#ff2a55',
    backgroundColor: 'rgba(255, 42, 85, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: '#ff2a55',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 14,
  },
  endureText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 2,
  },
  instructionBox: {
    width: '100%',
    backgroundColor: 'rgba(11, 15, 25, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    gap: 6,
  },
  instructionTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#ffb25c',
    letterSpacing: 1.5,
  },
  instructionDetail: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 17,
  },
  skipBtn: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  skipBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.6)',
    letterSpacing: 1.5,
  },
});

