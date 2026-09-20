import { useState, useEffect, useRef, useCallback } from 'react';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { LocationObject, LocationSubscription } from 'expo-location';

import {
  haversineDistance,
  isValidWalkingPoint,
  mpsToKmh,
} from '../utils/haversine';
import {
  WALK_TASK_NAME,
  WALK_DISTANCE_KEY,
  WALK_LAST_POINT_KEY,
  WALK_STATUS_KEY,
} from '../tasks/locationTask';

// ─── Constants ────────────────────────────────────────────────────────────────
export const TARGET_DISTANCE_M = 3000; // 3 km

export type WalkStatus =
  | 'idle'
  | 'requesting_permission'
  | 'permission_denied'
  | 'active'
  | 'paused'
  | 'completed';

export interface WalkState {
  status:        WalkStatus;
  distanceM:     number;       // metres walked so far
  speedKmh:      string;       // current speed in km/h (string for display)
  elapsedSec:    number;       // wall-clock seconds since quest start
  progressPct:   number;       // 0-100
  isSimulating?: boolean;
}

interface UseWalkingQuestOptions {
  onComplete?: (distanceM: number, elapsedSec: number) => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useWalkingQuest({ onComplete }: UseWalkingQuestOptions = {}) {
  const [state, setState] = useState<WalkState>({
    status:      'idle',
    distanceM:   0,
    speedKmh:    '0.0',
    elapsedSec:  0,
    progressPct: 0,
    isSimulating: false,
  });

  const lastPointRef     = useRef<LocationObject | null>(null);
  const distanceRef      = useRef(0);          // local accumulator (foreground)
  const subscriptionRef  = useRef<LocationSubscription | null>(null);
  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null);
  const simTimerRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef       = useRef(0);
  const completedRef     = useRef(false);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const updateDistance = useCallback((extra: number, currentSpeed: number) => {
    distanceRef.current += extra;
    const pct = Math.min(100, (distanceRef.current / TARGET_DISTANCE_M) * 100);

    setState(prev => ({
      ...prev,
      distanceM:   distanceRef.current,
      speedKmh:    mpsToKmh(currentSpeed),
      progressPct: pct,
    }));

    if (distanceRef.current >= TARGET_DISTANCE_M && !completedRef.current) {
      completedRef.current = true;
      handleComplete();
    }
  }, []);

  const startTimer = useCallback(() => {
    if (timerRef.current) return;
    timerRef.current = setInterval(() => {
      elapsedRef.current += 1;
      setState(prev => ({ ...prev, elapsedSec: elapsedRef.current }));
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (simTimerRef.current) {
      clearInterval(simTimerRef.current);
      simTimerRef.current = null;
    }
  }, []);

  // ── Permission ─────────────────────────────────────────────────────────────

  const requestPermission = useCallback(async (): Promise<boolean> => {
    setState(prev => ({ ...prev, status: 'requesting_permission' }));

    try {
      const { status: fg } = await Location.requestForegroundPermissionsAsync();
      if (fg !== 'granted') {
        setState(prev => ({ ...prev, status: 'permission_denied' }));
        return false;
      }

      // Background permission - optional and native only
      if (Platform.OS !== 'web') {
        try {
          await Location.requestBackgroundPermissionsAsync();
        } catch {}
      }

      return true;
    } catch {
      setState(prev => ({ ...prev, status: 'permission_denied' }));
      return false;
    }
  }, []);

  // ── Background task helpers ────────────────────────────────────────────────

  const startBackgroundTask = useCallback(async () => {
    if (Platform.OS === 'web') return;
    try {
      const isRegistered = await TaskManager.isTaskRegisteredAsync(WALK_TASK_NAME);
      if (isRegistered) return;

      await Location.startLocationUpdatesAsync(WALK_TASK_NAME, {
        accuracy:              Location.Accuracy.BestForNavigation,
        distanceInterval:      10,        // fire every 10 m minimum
        deferredUpdatesInterval: 5000,    // or every 5 s
        foregroundService: {              // Android - keeps tracking alive
          notificationTitle: 'Solo Leveling Quest',
          notificationBody:  'Recording your walk...',
          notificationColor: '#00e5ff',
        },
        pausesUpdatesAutomatically: false,
      });
    } catch (e) {
      console.warn('[WalkQuest] Background location unavailable:', e);
    }
  }, []);

  const stopBackgroundTask = useCallback(async () => {
    if (Platform.OS === 'web') return;
    try {
      const isRegistered = await TaskManager.isTaskRegisteredAsync(WALK_TASK_NAME);
      if (isRegistered) {
        await Location.stopLocationUpdatesAsync(WALK_TASK_NAME);
      }
    } catch {}
  }, []);

  // ── Foreground watcher ─────────────────────────────────────────────────────

  const startForegroundWatch = useCallback(async () => {
    if (subscriptionRef.current) return;

    try {
      subscriptionRef.current = await Location.watchPositionAsync(
        {
          accuracy:         Location.Accuracy.BestForNavigation,
          distanceInterval: 5,   // fire on every 5 m of movement
          timeInterval:     2000,
        },
        (location) => {
          const prev = lastPointRef.current;

          if (!prev) {
            lastPointRef.current = location;
            return;
          }

          if (isValidWalkingPoint(prev, location)) {
            const delta = haversineDistance(
              prev.coords.latitude,  prev.coords.longitude,
              location.coords.latitude, location.coords.longitude,
            );
            lastPointRef.current = location;
            const speed = location.coords.speed ?? 0;
            updateDistance(delta, speed > 0 ? speed : 1.4);
          }
        },
      );
    } catch (err) {
      console.warn('[WalkQuest] watchPositionAsync error:', err);
    }
  }, [updateDistance]);

  const stopForegroundWatch = useCallback(() => {
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
  }, []);

  // ── Complete ───────────────────────────────────────────────────────────────

  const handleComplete = useCallback(async () => {
    stopTimer();
    stopForegroundWatch();
    await stopBackgroundTask();

    setState(prev => ({
      ...prev,
      status:      'completed',
      progressPct: 100,
      distanceM:   TARGET_DISTANCE_M,
    }));

    await AsyncStorage.multiSet([
      [WALK_STATUS_KEY,    'completed'],
      [WALK_DISTANCE_KEY,  TARGET_DISTANCE_M.toString()],
    ]);

    onComplete?.(distanceRef.current, elapsedRef.current);
  }, [stopTimer, stopForegroundWatch, stopBackgroundTask, onComplete]);

  // ── Public API ─────────────────────────────────────────────────────────────

  const startWalk = useCallback(async () => {
    distanceRef.current  = 0;
    elapsedRef.current   = 0;
    completedRef.current = false;
    lastPointRef.current = null;

    await AsyncStorage.multiRemove([WALK_DISTANCE_KEY, WALK_LAST_POINT_KEY, WALK_STATUS_KEY]);

    const granted = await requestPermission();
    if (!granted) return;

    setState(prev => ({
      ...prev,
      status:      'active',
      distanceM:   0,
      speedKmh:    '0.0',
      elapsedSec:  0,
      progressPct: 0,
      isSimulating: false,
    }));

    await startForegroundWatch();
    await startBackgroundTask().catch(() => {});
    startTimer();
  }, [requestPermission, startForegroundWatch, startBackgroundTask, startTimer]);

  /** Simulation mode for treadmill / indoor / web test */
  const startSimulation = useCallback(() => {
    distanceRef.current  = 0;
    elapsedRef.current   = 0;
    completedRef.current = false;

    setState({
      status:      'active',
      distanceM:   0,
      speedKmh:    '5.2',
      elapsedSec:  0,
      progressPct: 0,
      isSimulating: true,
    });

    startTimer();

    if (simTimerRef.current) clearInterval(simTimerRef.current);
    simTimerRef.current = setInterval(() => {
      // simulate walking pace (~15 meters every second ≈ 54 km/h rapid test or ~100m steps)
      updateDistance(50, 1.45);
    }, 1000);
  }, [startTimer, updateDistance]);

  const pauseWalk = useCallback(async () => {
    stopForegroundWatch();
    await stopBackgroundTask();
    stopTimer();
    setState(prev => ({ ...prev, status: 'paused' }));
  }, [stopForegroundWatch, stopBackgroundTask, stopTimer]);

  const resumeWalk = useCallback(async () => {
    lastPointRef.current = null;
    if (state.isSimulating) {
      startTimer();
      if (simTimerRef.current) clearInterval(simTimerRef.current);
      simTimerRef.current = setInterval(() => {
        updateDistance(50, 1.45);
      }, 1000);
    } else {
      await startForegroundWatch();
      await startBackgroundTask().catch(() => {});
      startTimer();
    }
    setState(prev => ({ ...prev, status: 'active' }));
  }, [startForegroundWatch, startBackgroundTask, startTimer, state.isSimulating, updateDistance]);

  const stopWalk = useCallback(async () => {
    stopForegroundWatch();
    await stopBackgroundTask();
    stopTimer();
    setState(prev => ({ ...prev, status: 'idle', distanceM: 0, progressPct: 0, isSimulating: false }));
    distanceRef.current  = 0;
    elapsedRef.current   = 0;
    completedRef.current = false;
    await AsyncStorage.multiRemove([WALK_DISTANCE_KEY, WALK_LAST_POINT_KEY, WALK_STATUS_KEY]);
  }, [stopForegroundWatch, stopBackgroundTask, stopTimer]);

  useEffect(() => {
    return () => {
      stopForegroundWatch();
      stopTimer();
    };
  }, []);

  return { state, startWalk, startSimulation, pauseWalk, resumeWalk, stopWalk };
}
