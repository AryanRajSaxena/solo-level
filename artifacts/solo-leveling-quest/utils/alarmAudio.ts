import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type SoloLevelingAlarmTone = 'system_emergency' | 'shadow_monarch' | 'architect_dungeon';

export interface ToneInfo {
  id: SoloLevelingAlarmTone;
  name: string;
  subtitle: string;
  badge: string;
}

export const SOLO_LEVELING_ALARM_TONES: ToneInfo[] = [
  {
    id: 'system_emergency',
    name: 'System Emergency Directive',
    subtitle: 'Piercing Red Gate warning klaxon & dimensional drone',
    badge: 'DEFAULT',
  },
  {
    id: 'shadow_monarch',
    name: 'Shadow Monarch: Arise',
    subtitle: 'Deep resonance pulse & ascending spectral power aura',
    badge: 'S-RANK',
  },
  {
    id: 'architect_dungeon',
    name: "Architect's Cartenon Trial",
    subtitle: 'Menacing double dungeon mechanical pulse & penalty chime',
    badge: 'TRIAL',
  },
];

const ALARM_SETTINGS_KEY = '@solo-leveling-quest/alarm-settings-v1';

class AlarmAudioManager {
  private audioCtx: any = null;
  private isAlarmPlaying: boolean = false;
  private isPreviewPlaying: boolean = false;
  private alarmInterval: any = null;
  private previewTimeout: any = null;
  private activeTone: SoloLevelingAlarmTone = 'system_emergency';

  constructor() {
    this.initSavedTone();
  }

  private async initSavedTone() {
    try {
      const stored = await AsyncStorage.getItem(ALARM_SETTINGS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.tone && ['system_emergency', 'shadow_monarch', 'architect_dungeon'].includes(parsed.tone)) {
          this.activeTone = parsed.tone;
        }
      }
    } catch {}
  }

  public getActiveTone(): SoloLevelingAlarmTone {
    return this.activeTone;
  }

  public setActiveTone(tone: SoloLevelingAlarmTone) {
    this.activeTone = tone;
  }

  private getAudioContext() {
    if (Platform.OS !== 'web') return null;
    if (typeof window === 'undefined') return null;
    const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!this.audioCtx) {
      this.audioCtx = new AudioContextClass();
    }
    if (this.audioCtx.state === 'suspended') {
      void this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  private playTonePulse(tone: SoloLevelingAlarmTone) {
    if (!this.audioCtx) return;
    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    if (tone === 'shadow_monarch') {
      // ─── SHADOW MONARCH: ARISE ───
      // Sub drone
      const sub = ctx.createOscillator();
      const subGain = ctx.createGain();
      sub.type = 'sawtooth';
      sub.frequency.setValueAtTime(55, now);
      sub.frequency.exponentialRampToValueAtTime(110, now + 0.6);

      const subFilter = ctx.createBiquadFilter();
      subFilter.type = 'lowpass';
      subFilter.frequency.setValueAtTime(280, now);
      subFilter.frequency.linearRampToValueAtTime(700, now + 0.4);

      subGain.gain.setValueAtTime(0.01, now);
      subGain.gain.linearRampToValueAtTime(0.3, now + 0.1);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

      sub.connect(subFilter);
      subFilter.connect(subGain);
      subGain.connect(ctx.destination);
      sub.start(now);
      sub.stop(now + 0.9);

      // Ethereal chord shimmer (A3, C#4, E4)
      [220, 277.18, 329.63].forEach((freq) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + 0.08);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.5, now + 0.65);

        g.gain.setValueAtTime(0.001, now + 0.08);
        g.gain.linearRampToValueAtTime(0.12, now + 0.25);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);

        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(now + 0.08);
        osc.stop(now + 0.85);
      });
    } else if (tone === 'architect_dungeon') {
      // ─── ARCHITECT'S CARTENON TRIAL ───
      // Mechanical penalty click
      const click = ctx.createOscillator();
      const clickGain = ctx.createGain();
      click.type = 'square';
      click.frequency.setValueAtTime(180, now);
      click.frequency.exponentialRampToValueAtTime(60, now + 0.12);

      clickGain.gain.setValueAtTime(0.35, now);
      clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      click.connect(clickGain);
      clickGain.connect(ctx.destination);
      click.start(now);
      click.stop(now + 0.16);

      // Holographic penalty alert chime (rapid twin beep)
      [1760, 2093].forEach((f, i) => {
        const ping = ctx.createOscillator();
        const pGain = ctx.createGain();
        const pStart = now + 0.12 + i * 0.1;
        ping.type = 'triangle';
        ping.frequency.setValueAtTime(f, pStart);

        pGain.gain.setValueAtTime(0.01, pStart);
        pGain.gain.linearRampToValueAtTime(0.25, pStart + 0.02);
        pGain.gain.exponentialRampToValueAtTime(0.001, pStart + 0.2);

        ping.connect(pGain);
        pGain.connect(ctx.destination);
        ping.start(pStart);
        ping.stop(pStart + 0.22);
      });

      // Low ominous rumble
      const bass = ctx.createOscillator();
      const bGain = ctx.createGain();
      bass.type = 'sawtooth';
      bass.frequency.setValueAtTime(73.4, now);

      bGain.gain.setValueAtTime(0.01, now);
      bGain.gain.linearRampToValueAtTime(0.2, now + 0.1);
      bGain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

      bass.connect(bGain);
      bGain.connect(ctx.destination);
      bass.start(now);
      bass.stop(now + 0.7);
    } else {
      // ─── SYSTEM EMERGENCY DIRECTIVE (DEFAULT) ───
      // Iconic high-pitch twin alert klaxon (C6 -> E6)
      [
        { f: 1046.5, t: 0 },
        { f: 1318.5, t: 0.14 },
      ].forEach(({ f, t }) => {
        const siren = ctx.createOscillator();
        const sGain = ctx.createGain();
        const sStart = now + t;
        siren.type = 'sawtooth';
        siren.frequency.setValueAtTime(f, sStart);
        siren.frequency.linearRampToValueAtTime(f * 1.12, sStart + 0.1);

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(f, sStart);
        filter.Q.setValueAtTime(3.5, sStart);

        sGain.gain.setValueAtTime(0.01, sStart);
        sGain.gain.linearRampToValueAtTime(0.35, sStart + 0.02);
        sGain.gain.exponentialRampToValueAtTime(0.001, sStart + 0.12);

        siren.connect(filter);
        filter.connect(sGain);
        sGain.connect(ctx.destination);
        siren.start(sStart);
        siren.stop(sStart + 0.13);
      });

      // Dimensional Gate Low Drone
      const gate = ctx.createOscillator();
      const gateGain = ctx.createGain();
      gate.type = 'sawtooth';
      gate.frequency.setValueAtTime(65.4, now);
      gate.frequency.linearRampToValueAtTime(130.8, now + 0.4);

      const gFilter = ctx.createBiquadFilter();
      gFilter.type = 'lowpass';
      gFilter.frequency.setValueAtTime(260, now);

      gateGain.gain.setValueAtTime(0.01, now);
      gateGain.gain.linearRampToValueAtTime(0.28, now + 0.08);
      gateGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

      gate.connect(gFilter);
      gFilter.connect(gateGain);
      gateGain.connect(ctx.destination);
      gate.start(now);
      gate.stop(now + 0.65);
    }
  }

  /**
   * Start the continuous alarm loop using the selected tone.
   */
  startAlarm(toneOverride?: SoloLevelingAlarmTone) {
    if (this.isAlarmPlaying) return;
    this.isAlarmPlaying = true;
    const toneToPlay = toneOverride || this.activeTone;

    if (Platform.OS !== 'web') {
      try {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } catch {}
    }

    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const intervalMs = toneToPlay === 'shadow_monarch' ? 1050 : toneToPlay === 'architect_dungeon' ? 780 : 720;
      this.playTonePulse(toneToPlay);
      this.alarmInterval = setInterval(() => {
        if (!this.isAlarmPlaying) return;
        this.playTonePulse(toneToPlay);
      }, intervalMs);
    } catch (e) {
      console.warn('Could not start alarm audio:', e);
    }
  }

  /**
   * Stop the active alarm.
   */
  stopAlarm() {
    this.isAlarmPlaying = false;
    this.stopPreview();
    if (this.alarmInterval) {
      clearInterval(this.alarmInterval);
      this.alarmInterval = null;
    }
  }

  /**
   * Preview a tone in settings for 2.5 seconds.
   */
  previewTone(tone: SoloLevelingAlarmTone, onFinish?: () => void) {
    this.stopAlarm();
    const ctx = this.getAudioContext();
    if (!ctx) return;

    this.isPreviewPlaying = true;
    const intervalMs = tone === 'shadow_monarch' ? 1050 : tone === 'architect_dungeon' ? 780 : 720;
    this.playTonePulse(tone);

    const subInterval = setInterval(() => {
      if (!this.isPreviewPlaying) {
        clearInterval(subInterval);
        return;
      }
      this.playTonePulse(tone);
    }, intervalMs);

    this.previewTimeout = setTimeout(() => {
      this.stopPreview();
      clearInterval(subInterval);
      onFinish?.();
    }, 2500);
  }

  stopPreview() {
    this.isPreviewPlaying = false;
    if (this.previewTimeout) {
      clearTimeout(this.previewTimeout);
      this.previewTimeout = null;
    }
  }

  getIsPreviewPlaying(): boolean {
    return this.isPreviewPlaying;
  }

  /**
   * Play the iconic Solo Leveling System window chime.
   */
  playSystemNotificationSound() {
    const ctx = this.getAudioContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      [
        { f: 1567.98, t: 0, d: 0.08 },
        { f: 2093.0, t: 0.07, d: 0.22 },
      ].forEach(({ f, t, d }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + t;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, start);

        gain.gain.setValueAtTime(0.01, start);
        gain.gain.linearRampToValueAtTime(0.3, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + d);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + d + 0.05);
      });
    } catch {}
  }

  /**
   * Play a low error buzzer on wrong answer.
   */
  playWrongSound() {
    if (Platform.OS !== 'web') {
      try {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } catch {}
    }

    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(110, now);
      osc.frequency.linearRampToValueAtTime(85, now + 0.35);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.35);
    } catch {}
  }

  /**
   * Play a crisp rising triumph chime on trial completion.
   */
  playCorrectSound() {
    if (Platform.OS !== 'web') {
      try {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
    }

    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        const startTime = now + idx * 0.08;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.001, startTime);
        gain.gain.linearRampToValueAtTime(0.2, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.45);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.5);
      });
    } catch {}
  }
}

export const alarmAudio = new AlarmAudioManager();
