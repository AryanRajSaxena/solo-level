/**
 * locationTask.ts
 *
 * This file MUST be imported in your root _layout.tsx (or App.tsx)
 * so the task is registered before the app renders.
 */

import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { LocationObject } from 'expo-location';

import { haversineDistance, isValidWalkingPoint } from '../utils/haversine';

export const WALK_TASK_NAME       = 'SOLO_LEVELING_WALK_TASK';
export const WALK_DISTANCE_KEY    = '@solo_leveling:walk_distance_m';
export const WALK_LAST_POINT_KEY  = '@solo_leveling:walk_last_point';
export const WALK_STATUS_KEY      = '@solo_leveling:walk_status';

type TaskPayload = {
  locations: LocationObject[];
  error?: { message: string };
};

if (Platform.OS !== 'web') {
  try {
    TaskManager.defineTask(WALK_TASK_NAME, async ({ data, error }: { data: TaskPayload; error: any }) => {
      if (error) {
        console.warn('[WalkTask] Error:', error?.message);
        return;
      }

      const { locations } = data;
      if (!locations?.length) return;

      try {
        const [distStr, lastPointStr] = await AsyncStorage.multiGet([
          WALK_DISTANCE_KEY,
          WALK_LAST_POINT_KEY,
        ]);

        let totalDistance = parseFloat(distStr[1] ?? '0') || 0;
        let lastPoint: LocationObject | null = lastPointStr[1]
          ? JSON.parse(lastPointStr[1])
          : null;

        for (const location of locations) {
          if (!lastPoint || isValidWalkingPoint(lastPoint, location)) {
            if (lastPoint) {
              totalDistance += haversineDistance(
                lastPoint.coords.latitude,  lastPoint.coords.longitude,
                location.coords.latitude,   location.coords.longitude,
              );
            }
            lastPoint = location;
          }
        }

        await AsyncStorage.multiSet([
          [WALK_DISTANCE_KEY,   totalDistance.toString()],
          [WALK_LAST_POINT_KEY, JSON.stringify(lastPoint)],
        ]);
      } catch (e) {
        console.warn('[WalkTask] AsyncStorage error:', e);
      }
    });
  } catch (e) {
    console.warn('[WalkTask] Task definition error:', e);
  }
}
