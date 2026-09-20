import React, { useEffect } from 'react';
import { StyleSheet, Text, View, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
} from 'react-native-reanimated';

interface AlarmCompletedScreenProps {
  onFinished: () => void;
}

export const AlarmCompletedScreen = ({ onFinished }: AlarmCompletedScreenProps) => {
  const scale = useSharedValue(0.8);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withTiming(1, { duration: 400 });
    opacity.value = withTiming(1, { duration: 400 });

    const timer = setTimeout(() => {
      onFinished();
    }, 2200);

    return () => clearTimeout(timer);
  }, [onFinished, opacity, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.card, animatedStyle]}>
        {/* Glowing Crest */}
        <View style={styles.crestCircle}>
          <Feather name="check" size={36} color="#ffb25c" />
        </View>

        {/* System Message */}
        <Text style={styles.systemHeader}>[System] All trials complete.</Text>
        <Text style={styles.systemSubheader}>
          [System] The System is satisfied, Hunter.
        </Text>

        {/* Rewards Section in Gold */}
        <View style={styles.rewardsBox}>
          <Text style={styles.rewardItem}>+50 XP</Text>
          <Text style={styles.rewardDivider}>·</Text>
          <Text style={styles.rewardItem}>+1 DISCIPLINE</Text>
        </View>

        <Text style={styles.silencedNotice}>SYSTEM PROTOCOL SILENCED</Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: 'rgba(11, 15, 25, 0.95)',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#ffb25c',
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#ffb25c',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
  },
  crestCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: '#ffb25c',
    backgroundColor: 'rgba(255, 178, 92, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#ffb25c',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
  },
  systemHeader: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffb25c',
    letterSpacing: 1.2,
    textAlign: 'center',
    marginBottom: 6,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  systemSubheader: {
    fontSize: 13,
    color: '#00e5ff',
    letterSpacing: 0.8,
    textAlign: 'center',
    marginBottom: 24,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  rewardsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 178, 92, 0.4)',
    backgroundColor: 'rgba(255, 178, 92, 0.1)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginBottom: 16,
  },
  rewardItem: {
    fontSize: 18,
    fontWeight: '900',
    color: '#ffb25c',
    letterSpacing: 1.5,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  rewardDivider: {
    fontSize: 18,
    color: '#ffb25c',
  },
  silencedNotice: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.4)',
    letterSpacing: 2,
    marginTop: 8,
  },
});

