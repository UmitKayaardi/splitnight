/**
 * Short voice clips with MediaRecorder. Chrome/Android record webm/opus, Firefox ogg or webm,
 * iOS Safari mp4/AAC — we pick the first type the browser supports.
 */
import { LIMITS } from '../../shared/schemas';

export type RecorderError = 'denied' | 'unsupported' | 'failed';

export class RecorderFailure extends Error {
  constructor(readonly reason: RecorderError) {
    super(reason);
  }
}

const MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4;codecs=mp4a.40.2',
  'audio/mp4',
  'audio/ogg;codecs=opus',
  'audio/aac',
];

export function isRecordingSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.MediaRecorder !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia
  );
}

export function pickMimeType(
  isSupported: (type: string) => boolean = (t) => MediaRecorder.isTypeSupported(t),
): string | null {
  for (const type of MIME_CANDIDATES) {
    try {
      if (isSupported(type)) return type;
    } catch {
      // isTypeSupported can throw on very old browsers.
    }
  }
  return null;
}

/** "audio/webm;codecs=opus" → "audio/webm" — the server checks the base type. */
export function baseMimeType(type: string): string {
  return type.split(';')[0]!.trim().toLowerCase();
}

export interface Recording {
  blob: Blob;
  durationMs: number;
}

export class VoiceRecorder {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private audioCtx: AudioContext | null = null;
  private raf = 0;
  private limitTimer: ReturnType<typeof setTimeout> | null = null;
  private startedAt = 0;
  private stopResolve: ((r: Recording) => void) | null = null;

  constructor(
    private readonly onLevel: (level: number) => void,
    private readonly onAutoStop: () => void,
  ) {}

  async start(): Promise<void> {
    if (!isRecordingSupported()) throw new RecorderFailure('unsupported');
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
      });
    } catch (error) {
      const name = (error as DOMException)?.name;
      if (name === 'NotAllowedError' || name === 'SecurityError')
        throw new RecorderFailure('denied');
      if (name === 'NotFoundError' || name === 'OverconstrainedError')
        throw new RecorderFailure('unsupported');
      throw new RecorderFailure('failed');
    }

    const mimeType = pickMimeType();
    try {
      this.recorder = new MediaRecorder(
        this.stream,
        mimeType ? { mimeType, audioBitsPerSecond: 48_000 } : undefined,
      );
    } catch {
      this.cleanup();
      throw new RecorderFailure('unsupported');
    }
    this.chunks = [];
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.recorder.onstop = () => {
      const type = baseMimeType(this.recorder?.mimeType || mimeType || 'audio/webm');
      const recording = {
        blob: new Blob(this.chunks, { type }),
        durationMs: performance.now() - this.startedAt,
      };
      this.cleanup();
      this.stopResolve?.(recording);
      this.stopResolve = null;
    };
    this.recorder.start(250);
    this.startedAt = performance.now();
    this.meter();
    this.limitTimer = setTimeout(() => this.onAutoStop(), LIMITS.audioSeconds * 1000);
  }

  get elapsedMs(): number {
    return this.startedAt ? performance.now() - this.startedAt : 0;
  }

  stop(): Promise<Recording> {
    return new Promise((resolve) => {
      if (!this.recorder || this.recorder.state === 'inactive') {
        this.cleanup();
        resolve({ blob: new Blob([]), durationMs: 0 });
        return;
      }
      this.stopResolve = resolve;
      this.recorder.stop();
    });
  }

  cancel(): void {
    this.stopResolve = null;
    if (this.recorder && this.recorder.state !== 'inactive') {
      this.recorder.onstop = () => this.cleanup();
      this.recorder.stop();
    } else {
      this.cleanup();
    }
  }

  private meter(): void {
    if (!this.stream) return;
    try {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.audioCtx = new Ctor();
      const analyser = this.audioCtx.createAnalyser();
      analyser.fftSize = 512;
      this.audioCtx.createMediaStreamSource(this.stream).connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      const loop = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const v of data) sum += ((v - 128) / 128) ** 2;
        this.onLevel(Math.min(1, Math.sqrt(sum / data.length) * 4));
        this.raf = requestAnimationFrame(loop);
      };
      loop();
    } catch {
      // The level meter is decoration; recording works without it.
    }
  }

  private cleanup(): void {
    cancelAnimationFrame(this.raf);
    if (this.limitTimer) clearTimeout(this.limitTimer);
    this.limitTimer = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    void this.audioCtx?.close().catch(() => undefined);
    this.audioCtx = null;
    this.onLevel(0);
  }
}
