import { Platform } from "react-native";

type SoundType = "tap" | "wrong" | "combo" | "countdown" | "gameOver" | "newBest" | "levelUp";

class SoundManager {
  private audioContext: AudioContext | null = null;
  private enabled = true;

  private getContext(): AudioContext | null {
    if (Platform.OS !== "web") return null;
    if (!this.audioContext) {
      try {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch {
        return null;
      }
    }
    return this.audioContext;
  }

  setEnabled(val: boolean) {
    this.enabled = val;
  }

  play(type: SoundType) {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      switch (type) {
        case "tap":
          this.playTone(ctx, 880, 0.08, "sine", 0.15);
          this.playTone(ctx, 1320, 0.06, "sine", 0.1, 0.03);
          break;
        case "wrong":
          this.playTone(ctx, 200, 0.15, "sawtooth", 0.12);
          this.playTone(ctx, 150, 0.12, "sawtooth", 0.1, 0.08);
          break;
        case "combo":
          this.playTone(ctx, 523, 0.1, "sine", 0.12);
          this.playTone(ctx, 659, 0.1, "sine", 0.12, 0.08);
          this.playTone(ctx, 784, 0.1, "sine", 0.12, 0.16);
          break;
        case "countdown":
          this.playTone(ctx, 440, 0.12, "square", 0.08);
          break;
        case "gameOver":
          this.playTone(ctx, 440, 0.2, "sine", 0.15);
          this.playTone(ctx, 349, 0.2, "sine", 0.15, 0.15);
          this.playTone(ctx, 262, 0.3, "sine", 0.15, 0.3);
          break;
        case "newBest":
          this.playTone(ctx, 523, 0.12, "sine", 0.12);
          this.playTone(ctx, 659, 0.12, "sine", 0.12, 0.1);
          this.playTone(ctx, 784, 0.12, "sine", 0.12, 0.2);
          this.playTone(ctx, 1047, 0.2, "sine", 0.15, 0.3);
          break;
        case "levelUp":
          this.playTone(ctx, 392, 0.1, "sine", 0.1);
          this.playTone(ctx, 523, 0.1, "sine", 0.1, 0.1);
          this.playTone(ctx, 659, 0.1, "sine", 0.1, 0.2);
          this.playTone(ctx, 784, 0.15, "sine", 0.12, 0.3);
          break;
      }
    } catch {}
  }

  private playTone(
    ctx: AudioContext,
    freq: number,
    duration: number,
    waveType: OscillatorType,
    volume: number,
    delay = 0
  ) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = waveType;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
    gain.gain.setValueAtTime(volume, ctx.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + duration + 0.01);
  }
}

export const soundManager = new SoundManager();
