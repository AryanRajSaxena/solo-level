import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

export const ARCHITECT_TRIAL_TRACK = {
  name: "Architect's Cartenon Trial",
  subtitle: "Double Dungeon mechanical pulse & penalty directive",
  badge: "SYSTEM TRIAL",
};

class AlarmAudioManager {
  private audioCtx: any = null;
  private isAlarmPlaying: boolean = false;
  private isPreviewPlaying: boolean = false;
  private alarmInterval: any = null;
  private previewTimeout: any = null;

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

  /**
   * Play a single pulse of the Architect's Cartenon Trial alarm.
   */
  private playCartenonPulse() {
    if (!this.audioCtx) return;
    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    // ─── 1. Mechanical God Statue Clock Impact ───
    const click = ctx.createOscillator();
    const clickGain = ctx.createGain();
    click.type = 'square';
    click.frequency.setValueAtTime(196, now); // G3
    click.frequency.exponentialRampToValueAtTime(55, now + 0.14);

    clickGain.gain.setValueAtTime(0.35, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    click.connect(clickGain);
    clickGain.connect(ctx.destination);
    click.start(now);
    click.stop(now + 0.18);

    // ─── 2. Holographic System Alert Chime (Cartenon Temple Alert) ───
    [1760, 2093].forEach((f, i) => {
      const ping = ctx.createOscillator();
      const pGain = ctx.createGain();
      const pStart = now + 0.12 + i * 0.09;
      ping.type = 'triangle';
      ping.frequency.setValueAtTime(f, pStart);

      pGain.gain.setValueAtTime(0.01, pStart);
      pGain.gain.linearRampToValueAtTime(0.28, pStart + 0.02);
      pGain.gain.exponentialRampToValueAtTime(0.001, pStart + 0.2);

      ping.connect(pGain);
      pGain.connect(ctx.destination);
      ping.start(pStart);
      ping.stop(pStart + 0.22);
    });

    // ─── 3. Menacing Low Dungeon Drone ───
    const bass = ctx.createOscillator();
    const bGain = ctx.createGain();
    bass.type = 'sawtooth';
    bass.frequency.setValueAtTime(73.4, now); // D2

    const bFilter = ctx.createBiquadFilter();
    bFilter.type = 'lowpass';
    bFilter.frequency.setValueAtTime(320, now);

    bGain.gain.setValueAtTime(0.01, now);
    bGain.gain.linearRampToValueAtTime(0.25, now + 0.1);
    bGain.gain.exponentialRampToValueAtTime(0.001, now + 0.68);

    bass.connect(bFilter);
    bFilter.connect(bGain);
    bGain.connect(ctx.destination);
    bass.start(now);
    bass.stop(now + 0.72);
  }

  /**
   * Start the continuous Architect's Cartenon Trial alarm.
   */
  startAlarm() {
    if (this.isAlarmPlaying) return;
    this.isAlarmPlaying = true;

    if (Platform.OS !== 'web') {
      try {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } catch {}
    }

    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      this.playCartenonPulse();
      this.alarmInterval = setInterval(() => {
        if (!this.isAlarmPlaying) return;
        this.playCartenonPulse();
      }, 780);
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
   * Preview the alarm sound in settings.
   */
  previewAlarm(onFinish?: () => void) {
    this.stopAlarm();
    const ctx = this.getAudioContext();
    if (!ctx) return;

    this.isPreviewPlaying = true;
    this.playCartenonPulse();

    const subInterval = setInterval(() => {
      if (!this.isPreviewPlaying) {
        clearInterval(subInterval);
        return;
      }
      this.playCartenonPulse();
    }, 780);

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
