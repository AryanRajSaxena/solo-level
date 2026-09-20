import React, { useEffect } from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const PARTICLE_COUNT = 24;

interface ParticleProps {
  x: number;
  initialY: number;
  size: number;
  delay: number;
  duration: number;
  color: string;
}

const SingleParticle = ({ x, initialY, size, delay, duration, color }: ParticleProps) => {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(
        withTiming(0.8, { duration: duration / 2, easing: Easing.inOut(Easing.quad) }),
        -1,
        true
      )
    );

    translateY.value = withDelay(
      delay,
      withRepeat(
        withTiming(-80, { duration: duration, easing: Easing.linear }),
        -1,
        false
      )
    );
  }, [delay, duration, opacity, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.particle,
        {
          left: x,
          top: initialY,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        animatedStyle,
      ]}
    />
  );
};

export const ParticleBackground = () => {
  const particles = React.useMemo(() => {
    const list = [];
    const colors = ['#00e5ff', '#ffb25c', '#ffffff', '#00b4d8'];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      list.push({
        id: i,
        x: Math.random() * SCREEN_WIDTH,
        initialY: Math.random() * SCREEN_HEIGHT,
        size: Math.random() * 3 + 2,
        delay: Math.random() * 2000,
        duration: 3000 + Math.random() * 3000,
        color: colors[i % colors.length],
      });
    }
    return list;
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map((p) => (
        <SingleParticle key={p.id} {...p} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  particle: {
    position: 'absolute',
    shadowColor: '#00e5ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
});
