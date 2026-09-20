import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  StatusBar,
  Platform,
  SafeAreaView,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ParticleBackground } from '@/components/alarm/ParticleBackground';
import { AlarmHUDHeader } from '@/components/alarm/AlarmHUDHeader';
import { AlarmEnduranceView } from '@/components/alarm/AlarmEnduranceView';
import { MathChallengeScreen } from '@/components/alarm/MathChallengeScreen';
import { ManaSequenceChallengeScreen } from '@/components/alarm/ManaSequenceChallengeScreen';
import { DateChallengeScreen } from '@/components/alarm/DateChallengeScreen';
import { OathChallengeScreen } from '@/components/alarm/OathChallengeScreen';
import { AlarmCompletedScreen } from '@/components/alarm/AlarmCompletedScreen';
import { alarmAudio } from '@/utils/alarmAudio';
import { useQuestContext } from '@/context/QuestContext';

type AlarmStage = 'endurance' | 'trial_1' | 'trial_2' | 'trial_3' | 'trial_4' | 'completed';

export default function AlarmScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ testMode?: string }>();
  const isDirectTest = params.testMode === 'instant';

  const { awardAlarmRewards } = useQuestContext();
  const [stage, setStage] = useState<AlarmStage>(isDirectTest ? 'trial_1' : 'endurance');

  // Flash screen effect on success
  const flashOpacity = useSharedValue(0);

  const triggerGoldFlash = useCallback(() => {
    flashOpacity.value = withSequence(
      withTiming(0.35, { duration: 80 }),
      withTiming(0, { duration: 420 })
    );
  }, [flashOpacity]);

  const animatedFlashStyle = useAnimatedStyle(() => ({
    opacity: flashOpacity.value,
  }));

  // Start alarm audio on mount and ensure clean stop on unmount
  useEffect(() => {
    alarmAudio.startAlarm();
    return () => {
      alarmAudio.stopAlarm();
    };
  }, []);

  const handleEnduranceComplete = () => {
    setStage('trial_1');
  };

  const handleTrial1Success = () => {
    triggerGoldFlash();
    setStage('trial_2');
  };

  const handleTrial2Success = () => {
    triggerGoldFlash();
    setStage('trial_3');
  };

  const handleTrial3Success = () => {
    triggerGoldFlash();
    setStage('trial_4');
  };

  const handleTrial4Success = () => {
    triggerGoldFlash();
    alarmAudio.stopAlarm();
    setStage('completed');
  };

  const handleFinishAlarm = () => {
    awardAlarmRewards(50, 1);
    router.back();
  };

  const getCurrentTrialNumber = (): number => {
    switch (stage) {
      case 'trial_1': return 1;
      case 'trial_2': return 2;
      case 'trial_3': return 3;
      case 'trial_4': return 4;
      default: return 1;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#070b13" />
      
      {/* Animated Mana Particles */}
      <ParticleBackground />

      {/* Screen Gold Flash Overlay */}
      <Animated.View style={[styles.goldFlashOverlay, animatedFlashStyle]} pointerEvents="none" />

      <View style={styles.content}>
        {stage === 'endurance' && (
          <AlarmEnduranceView
            initialSeconds={30}
            onEnduranceComplete={handleEnduranceComplete}
            onSkipTest={() => setStage('trial_1')}
          />
        )}

        {stage !== 'endurance' && stage !== 'completed' && (
          <>
            <AlarmHUDHeader currentTrial={getCurrentTrialNumber()} />

            {stage === 'trial_1' && (
              <MathChallengeScreen onSuccess={handleTrial1Success} />
            )}

            {stage === 'trial_2' && (
              <ManaSequenceChallengeScreen onSuccess={handleTrial2Success} />
            )}

            {stage === 'trial_3' && (
              <DateChallengeScreen onSuccess={handleTrial3Success} />
            )}

            {stage === 'trial_4' && (
              <OathChallengeScreen onSuccess={handleTrial4Success} />
            )}
          </>
        )}

        {stage === 'completed' && (
          <AlarmCompletedScreen onFinished={handleFinishAlarm} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#070b13',
  },
  content: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? 24 : 8,
  },
  goldFlashOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#ffb25c',
    zIndex: 99,
  },
});
