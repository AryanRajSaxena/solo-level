import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

class AlarmAudioManager {
  private audioCtx: any = null;
  private isAlarmPlaying: boolean = false;
  private alarmInterval: any = null;

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
   * Start the continuous dramatic pulsating alarm sound.
   */
  startAlarm() {
    if (this.isAlarmPlaying) return;
    this.isAlarmPlaying = true;

    // Trigger initial haptic warning on native
    if (Platform.OS !== 'web') {
      try {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } catch {}
    }

    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const playPulse = () => {
        if (!this.isAlarmPlaying || !this.audioCtx) return;
        const now = this.audioCtx.currentTime;

        // Dark ominous twin-oscillator pulse
        const osc1 = this.audioCtx.createOscillator();
        const osc2 = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(140, now);
        osc1.frequency.exponentialRampToValueAtTime(320, now + 0.45);

        osc2.type = 'square';
        osc2.frequency.setValueAtTime(144, now);
        osc2.frequency.exponentialRampToValueAtTime(328, now + 0.45);

        // Sub filter
        const filter = this.audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, now);

        gain.gain.setValueAtTime(0.01, now);
        gain.gain.linearRampToValueAtTime(0.25, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.6);
        osc2.stop(now + 0.6);
      };

      playPulse();
      this.alarmInterval = setInterval(playPulse, 700);
    } catch (e) {
      console.warn('Could not start synthesized alarm audio:', e);
    }
  }

  /**
   * Stop the continuous alarm sound.
   */
  stopAlarm() {
    this.isAlarmPlaying = false;
    if (this.alarmInterval) {
      clearInterval(this.alarmInterval);
      this.alarmInterval = null;
    }
  }

  /**
   * Play a short, low error buzzer on wrong answer.
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
   * Play a crisp, rising triumph chime on trial completion.
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

