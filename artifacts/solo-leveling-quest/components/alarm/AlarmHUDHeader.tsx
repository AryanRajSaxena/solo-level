import React from 'react';
import { StyleSheet, Text, View, Platform } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withTiming,
  withSpring,
  useSharedValue,
} from 'react-native-reanimated';

interface AlarmHUDHeaderProps {
  currentTrial: number; // 1 to 4
  totalTrials?: number;
}

export const AlarmHUDHeader = ({ currentTrial, totalTrials = 4 }: AlarmHUDHeaderProps) => {
  return (
    <View style={styles.container}>
      {/* System Warning Banner */}
      <View style={styles.systemBox}>
        <View style={styles.badgeRow}>
          <View style={styles.alertBeacon} />
          <Text style={styles.systemTitle}>[System] Emergency Wake Protocol Activated</Text>
        </View>
        <Text style={styles.systemSubtitle}>
          Hunter, complete all trials to silence the System.
        </Text>
      </View>

      {/* Progress Indicator */}
      <View style={styles.progressRow}>
        <Text style={styles.progressLabel}>
          Trial {Math.min(currentTrial, totalTrials)} of {totalTrials}
        </Text>
        <View style={styles.dotsRow}>
          {Array.from({ length: totalTrials }, (_, i) => {
            const stepNum = i + 1;
            const isCompleted = stepNum < currentTrial;
            const isCurrent = stepNum === currentTrial;

            return (
              <View
                key={stepNum}
                style={[
                  styles.dotBase,
                  isCompleted && styles.dotCompleted,
                  isCurrent && styles.dotCurrent,
                ]}
              >
                {isCompleted ? (
                  <View style={styles.dotFilled} />
                ) : isCurrent ? (
                  <View style={styles.dotActivePulse} />
                ) : null}
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 12 : 8,
    marginBottom: 16,
  },
  systemBox: {
    borderWidth: 1,
    borderColor: 'rgba(255, 42, 85, 0.4)',
    backgroundColor: 'rgba(255, 42, 85, 0.08)',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 4,
    shadowColor: '#ff2a55',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  alertBeacon: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff2a55',
  },
  systemTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ff2a55',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  systemSubtitle: {
    fontSize: 11,
    color: '#ffb4c2',
    lineHeight: 16,
    letterSpacing: 0.4,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingHorizontal: 4,
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffb25c',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  dotBase: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 178, 92, 0.3)',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotCompleted: {
    borderColor: '#ffb25c',
    backgroundColor: 'rgba(255, 178, 92, 0.2)',
  },
  dotCurrent: {
    borderColor: '#00e5ff',
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    shadowColor: '#00e5ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  dotFilled: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ffb25c',
  },
  dotActivePulse: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00e5ff',
  },
});
