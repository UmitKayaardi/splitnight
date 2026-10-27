/**
 * Tiny UI sounds synthesised with the Web Audio API (no audio files), plus haptics.
 * Both are skipped when the user has muted SplitNight.
 */
import { usePrefs } from '../state/prefs';

export type FeedbackKind = 'tick' | 'pop' | 'success' | 'assign' | 'reveal' | 'roll';

let context: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    context ??= new Ctor();
    if (context.state === 'suspended') void context.resume();
    return context;
  } catch {
    return null;
  }
}

function tone(
  ctx: AudioContext,
  frequency: number,
  start: number,
  duration: number,
  type: OscillatorType,
  gain = 0.12,
) {
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, ctx.currentTime + start);
  amp.gain.setValueAtTime(0.0001, ctx.currentTime + start);
  amp.gain.exponentialRampToValueAtTime(gain, ctx.currentTime + start + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + duration);
  osc.connect(amp).connect(ctx.destination);
  osc.start(ctx.currentTime + start);
  osc.stop(ctx.currentTime + start + duration + 0.02);
  return osc;
}

const VIBRATION: Partial<Record<FeedbackKind, number | number[]>> = {
  assign: 12,
  reveal: [30, 40, 60],
  success: [20, 30, 20],
};

export function feedback(kind: FeedbackKind): void {
  if (!usePrefs.getState().sound) return;

  const pattern = VIBRATION[kind];
  // Browsers only allow vibration after the person has tapped the page.
  const activated =
    typeof navigator !== 'undefined' && navigator.userActivation?.hasBeenActive !== false;
  if (pattern && activated && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Some browsers expose vibrate but block it; that is fine.
    }
  }

  const ctx = audio();
  if (!ctx) return;
  switch (kind) {
    case 'tick':
      tone(ctx, 1400, 0, 0.03, 'square', 0.05);
      break;
    case 'assign':
      tone(ctx, 660, 0, 0.08, 'sine', 0.08);
      break;
    case 'pop': {
      const osc = tone(ctx, 300, 0, 0.12, 'triangle', 0.15);
      osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.1);
      break;
    }
    case 'roll':
      [0, 0.05, 0.1, 0.15].forEach((s, i) => tone(ctx, 500 + i * 120, s, 0.04, 'square', 0.04));
      break;
    case 'reveal':
      tone(ctx, 392, 0, 0.18, 'triangle');
      tone(ctx, 523, 0.12, 0.18, 'triangle');
      tone(ctx, 784, 0.24, 0.35, 'triangle');
      break;
    case 'success':
      tone(ctx, 523, 0, 0.16, 'sine', 0.1);
      tone(ctx, 659, 0.1, 0.16, 'sine', 0.1);
      tone(ctx, 784, 0.2, 0.3, 'sine', 0.1);
      break;
  }
}
