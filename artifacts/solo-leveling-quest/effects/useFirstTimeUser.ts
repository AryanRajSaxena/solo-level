import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_KEY = '@solo_leveling:onboarding_complete';
const HUNTER_NAME_KEY = '@solo_leveling:hunter_name';
const HUNTER_DATA_KEY = '@solo_leveling:hunter_data';

export interface HunterData {
  name: string;
  rank: string;
  level: number;
  xp: number;
  stats: {
    str: number;
    int: number;
    stamina: number;
    discipline: number;
  };
  titles: string[];
  streak: number;
  createdAt: string;
}

const DEFAULT_HUNTER: Omit<HunterData, 'name'> = {
  rank: 'E',
  level: 1,
  xp: 0,
  stats: { str: 10, int: 10, stamina: 10, discipline: 10 },
  titles: ['Novice Hunter'],
  streak: 0,
  createdAt: new Date().toISOString(),
};

export const useFirstTimeUser = () => {
  const [isFirstTime, setIsFirstTime] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkFirstTime();
  }, []);

  const checkFirstTime = async () => {
    try {
      const completed = await AsyncStorage.getItem(ONBOARDING_KEY);
      setIsFirstTime(completed === null);
    } catch {
      setIsFirstTime(true);
    } finally {
      setIsLoading(false);
    }
  };

  const completeOnboarding = async (hunterName: string): Promise<HunterData> => {
    const hunter: HunterData = { name: hunterName, ...DEFAULT_HUNTER };
    try {
      await AsyncStorage.multiSet([
        [ONBOARDING_KEY, 'true'],
        [HUNTER_NAME_KEY, hunterName],
        [HUNTER_DATA_KEY, JSON.stringify(hunter)],
      ]);
      setIsFirstTime(false);
    } catch (e) {
      console.error('Failed to save onboarding data:', e);
    }
    return hunter;
  };

  // Dev utility — call this to reset onboarding for testing
  const resetOnboarding = async () => {
    await AsyncStorage.multiRemove([ONBOARDING_KEY, HUNTER_NAME_KEY, HUNTER_DATA_KEY]);
    setIsFirstTime(true);
  };

  return { isFirstTime, isLoading, completeOnboarding, resetOnboarding };
};
