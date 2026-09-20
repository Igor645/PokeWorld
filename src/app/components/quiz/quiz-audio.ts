/**
 * Small synthesised sound kit for the quiz (no audio files).
 *
 * Every voice is a soft, bell-like pluck (triangle + a quiet octave and a brief inharmonic "tick" for the
 * attack) run through a low-pass filter into a short echo bus, so nothing is shrill. A correct answer is always the
 * same C5 pluck; the larger cues (milestone, section, victory) are arpeggios built from the same C-major-pentatonic notes.
 */

// C5; everything is expressed in semitones above it
const C5 = 523.25;

const hz = (semitones: number, base = C5): number => base * Math.pow(2, semitones / 12);

interface VoiceOpts {
  gain?: number;
  decay?: number;
  /** 1 = warm/mellow, higher = brighter */
  bright?: number;
  type?: OscillatorType;
}

export class QuizAudio {
  muted = false;

  private ctx: AudioContext | null = null;
  private bus!: GainNode;

  /** Lazily creates the graph; must first be reached from a user gesture (typing counts). */
  private ensure(): AudioContext | null {
    if (this.muted) return null;
    try {
      if (!this.ctx) {
        const ctx = new AudioContext();
        const master = ctx.createGain();
        master.gain.value = 0.85;
        master.connect(ctx.destination);

        // dry + a soft feedback echo standing in for a room
        const bus = ctx.createGain();
        const echo = ctx.createDelay(0.5);
        echo.delayTime.value = 0.14;
        const feedback = ctx.createGain();
        feedback.gain.value = 0.3;
        const damp = ctx.createBiquadFilter();
        damp.type = 'lowpass';
        damp.frequency.value = 2200;
        const wet = ctx.createGain();
        wet.gain.value = 0.24;
        bus.connect(master);
        bus.connect(echo);
        echo.connect(damp);
        damp.connect(feedback);
        feedback.connect(echo);
        damp.connect(wet);
        wet.connect(master);

        this.ctx = ctx;
        this.bus = bus;
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return this.ctx;
    } catch {
      return null;
    }
  }

  private voice(ctx: AudioContext, freq: number, at: number, o: VoiceOpts = {}): void {
    const { gain = 0.18, decay = 0.55, bright = 1, type = 'triangle' } = o;
    const out = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = Math.min(freq * 5 * bright, 6000);
    lp.Q.value = 0.4;
    out.gain.setValueAtTime(0.0001, at);
    out.gain.linearRampToValueAtTime(gain, at + 0.008);
    out.gain.exponentialRampToValueAtTime(0.0001, at + decay);
    lp.connect(out);
    out.connect(this.bus);

    const parts: Array<[OscillatorType, number, number, number]> = [
      [type, freq, 1, decay],
      ['sine', freq * 2, 0.22, decay * 0.7],
      ['sine', freq * 3.01, 0.05, 0.09],
    ];
    for (const [t, f, g, d] of parts) {
      const osc = ctx.createOscillator();
      const vg = ctx.createGain();
      osc.type = t;
      osc.frequency.value = f;
      vg.gain.setValueAtTime(g, at);
      vg.gain.exponentialRampToValueAtTime(0.0001, at + d);
      osc.connect(vg);
      vg.connect(lp);
      osc.start(at);
      osc.stop(at + d + 0.05);
    }
  }

  /** A right answer: always the same note, so every guess sounds as good as the first. */
  correct(): void {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime + 0.005;
    this.voice(ctx, hz(0), t, { gain: 0.23, decay: 0.6 });
    this.voice(ctx, hz(12), t + 0.055, { gain: 0.07, decay: 0.35, bright: 1.4, type: 'sine' });
  }

  /** Named something that was already on the board. */
  already(): void {
    const ctx = this.ensure();
    if (!ctx) return;
    this.voice(ctx, hz(-12), ctx.currentTime + 0.005, { gain: 0.1, decay: 0.16, bright: 0.7, type: 'sine' });
  }

  /** Crossed 25 / 50 / 75 %. */
  milestone(): void {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime + 0.005;
    this.voice(ctx, hz(7), t, { gain: 0.19, decay: 0.5 });
    this.voice(ctx, hz(14), t + 0.11, { gain: 0.2, decay: 0.9 });
    this.voice(ctx, hz(19), t + 0.11, { gain: 0.07, decay: 0.9, bright: 1.3 });
  }

  /** A whole section (generation, type …) is complete. */
  sectionDone(): void {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime + 0.005;
    [0, 4, 7, 12].forEach((s, i) => this.voice(ctx, hz(s), t + i * 0.075, { gain: 0.19, decay: 0.7 }));
    this.voice(ctx, hz(16), t + 0.3, { gain: 0.19, decay: 1.2 });
    this.voice(ctx, hz(19), t + 0.3, { gain: 0.07, decay: 1.2, bright: 1.3 });
  }

  /** Every last one. */
  victory(): void {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime + 0.01;
    [0, 4, 7, 12, 16, 19, 24].forEach((s, i) =>
      this.voice(ctx, hz(s), t + i * 0.085, { gain: 0.15, decay: 0.8, bright: 1.1 }));
    const chord = t + 0.7;
    [0, 4, 7, 12, 16].forEach(s => this.voice(ctx, hz(s), chord, { gain: 0.11, decay: 2.4, bright: 0.8 }));
    this.voice(ctx, hz(28), chord + 0.05, { gain: 0.06, decay: 1.6, type: 'sine' });
  }

  /** Giving up: a gentle step down rather than a buzzer. */
  giveUp(): void {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime + 0.005;
    [-3, -7, -12].forEach((s, i) => this.voice(ctx, hz(s), t + i * 0.13, { gain: 0.12, decay: 0.5, bright: 0.6 }));
  }

  dispose(): void {
    void this.ctx?.close();
    this.ctx = null;
  }
}
