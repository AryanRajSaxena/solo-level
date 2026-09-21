import { Linking, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

export interface RestrictedApp {
  id: string;
  name: string;
  packageName: string; // Android package identifier
  urlScheme: string;   // Deep link URL scheme
  webFallback: string; // Web URL fallback
  category: 'SOCIAL' | 'SHOPPING' | 'ENTERTAINMENT';
  featherIcon: string;
  accentColor: string;
  description: string;
}

export const RESTRICTED_APPS: RestrictedApp[] = [
  {
    id: 'instagram',
    name: 'Instagram',
    packageName: 'com.instagram.android',
    urlScheme: 'instagram://app',
    webFallback: 'https://www.instagram.com',
    category: 'SOCIAL',
    featherIcon: 'instagram',
    accentColor: '#E1306C',
    description: 'Reels, stories & feed distraction',
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    packageName: 'com.linkedin.android',
    urlScheme: 'linkedin://',
    webFallback: 'https://www.linkedin.com',
    category: 'SOCIAL',
    featherIcon: 'linkedin',
    accentColor: '#0A66C2',
    description: 'Professional social feed',
  },
  {
    id: 'facebook',
    name: 'Facebook',
    packageName: 'com.facebook.katana',
    urlScheme: 'fb://feed',
    webFallback: 'https://www.facebook.com',
    category: 'SOCIAL',
    featherIcon: 'facebook',
    accentColor: '#1877F2',
    description: 'Meta social networking feed',
  },
  {
    id: 'flipkart',
    name: 'Flipkart',
    packageName: 'com.flipkart.android',
    urlScheme: 'flipkart://',
    webFallback: 'https://www.flipkart.com',
    category: 'SHOPPING',
    featherIcon: 'shopping-cart',
    accentColor: '#2874F0',
    description: 'E-commerce marketplace portal',
  },
  {
    id: 'amazon',
    name: 'Amazon',
    packageName: 'com.amazon.mShop.android.shopping',
    urlScheme: 'amazon://',
    webFallback: 'https://www.amazon.in',
    category: 'SHOPPING',
    featherIcon: 'shopping-bag',
    accentColor: '#FF9900',
    description: 'E-commerce shopping portal',
  },
  {
    id: 'myntra',
    name: 'Myntra',
    packageName: 'com.myntra.android',
    urlScheme: 'myntra://',
    webFallback: 'https://www.myntra.com',
    category: 'SHOPPING',
    featherIcon: 'package',
    accentColor: '#FF3F6C',
    description: 'Fashion & apparel portal',
  },
  {
    id: 'twitter',
    name: 'X (Twitter)',
    packageName: 'com.twitter.android',
    urlScheme: 'twitter://timeline',
    webFallback: 'https://x.com',
    category: 'SOCIAL',
    featherIcon: 'twitter',
    accentColor: '#1DA1F2',
    description: 'Real-time social discussions',
  },
  {
    id: 'youtube',
    name: 'YouTube',
    packageName: 'com.google.android.youtube',
    urlScheme: 'vnd.youtube://',
    webFallback: 'https://www.youtube.com',
    category: 'ENTERTAINMENT',
    featherIcon: 'youtube',
    accentColor: '#FF0000',
    description: 'Shorts & video feed stream',
  },
];

/**
 * Check if the penalty lockdown is currently active
 */
export function isLockdownActive(lockdownUntil: number | null): boolean {
  if (!lockdownUntil) return false;
  return lockdownUntil > Date.now();
}

/**
 * Calculate remaining lockdown time in hours, minutes, and seconds
 */
export function getRemainingLockdownTime(lockdownUntil: number | null): {
  hours: number;
  minutes: number;
  seconds: number;
  formatted: string;
  isExpired: boolean;
} {
  if (!lockdownUntil || lockdownUntil <= Date.now()) {
    return { hours: 0, minutes: 0, seconds: 0, formatted: '00:00:00', isExpired: true };
  }

  const diffMs = Math.max(0, lockdownUntil - Date.now());
  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const hStr = hours.toString().padStart(2, '0');
  const mStr = minutes.toString().padStart(2, '0');
  const sStr = seconds.toString().padStart(2, '0');

  return {
    hours,
    minutes,
    seconds,
    formatted: `${hStr}:${mStr}:${sStr}`,
    isExpired: false,
  };
}

/**
 * Synthesizes an authentic Solo Leveling Red Gate Access Violation Alert sound
 */
export function playViolationAlertSound() {
  if (Platform.OS === 'web') {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      // 1. Harsh Warning Klaxon (Sawtooth wave 880Hz -> 440Hz alert sirens)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(880, now);
      osc1.frequency.exponentialRampToValueAtTime(440, now + 0.15);
      osc1.frequency.setValueAtTime(880, now + 0.18);
      osc1.frequency.exponentialRampToValueAtTime(440, now + 0.35);

      gain1.gain.setValueAtTime(0.25, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.42);

      // 2. Heavy Sub-bass system buzz
      const sub = ctx.createOscillator();
      const subGain = ctx.createGain();
      sub.type = 'triangle';
      sub.frequency.setValueAtTime(110, now);
      sub.frequency.exponentialRampToValueAtTime(55, now + 0.4);
      subGain.gain.setValueAtTime(0.3, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      sub.connect(subGain);
      subGain.connect(ctx.destination);
      sub.start(now);
      sub.stop(now + 0.46);
    } catch {
      // AudioContext unavailable or blocked by user gesture
    }
  }

  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
}

/**
 * Attempts to launch a restricted app.
 * If lockdown is active, blocks launch, plays violation sound, triggers error haptics,
 * and calls onBlocked callback.
 * If lockdown is inactive, opens the deep link or web fallback.
 */
export async function attemptLaunchRestrictedApp(
  app: RestrictedApp,
  isLocked: boolean,
  onBlocked: () => void,
): Promise<boolean> {
  if (isLocked) {
    playViolationAlertSound();
    onBlocked();
    return false;
  }

  try {
    const canOpen = await Linking.canOpenURL(app.urlScheme);
    if (canOpen) {
      await Linking.openURL(app.urlScheme);
      return true;
    }
  } catch {
    // Fall back to web URL if scheme fails
  }

  try {
    await Linking.openURL(app.webFallback);
    return true;
  } catch {
    return false;
  }
}
