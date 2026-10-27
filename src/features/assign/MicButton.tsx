import { Loader2, Mic, Square } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { errorCodeOf, transcribe } from '../../lib/api';
import { feedback } from '../../lib/feedback';
import { isRecordingSupported, RecorderFailure, VoiceRecorder } from '../../lib/recorder';
import { useBill } from '../../state/bill';
import { usePrefs } from '../../state/prefs';

type Phase = 'idle' | 'starting' | 'recording' | 'transcribing';

const MIN_DURATION_MS = 600;

/**
 * Press-and-hold to talk (release to send), or tap to start and tap to stop.
 * Shows a live level meter and stops automatically after 60 seconds.
 */
export function MicButton({
  disabled,
  onTranscript,
  onUnavailable,
  statusSlot: slot,
}: {
  /** Status messages render here, below the composer, outside this narrow column. */
  statusSlot: HTMLElement | null;
  disabled?: boolean;
  onTranscript: (text: string) => void;
  onUnavailable: () => void;
}) {
  const { t } = useTranslation();
  const mode = usePrefs((s) => s.micMode);
  const setMode = usePrefs((s) => s.setMicMode);
  const [phase, setPhase] = useState<Phase>('idle');
  const [level, setLevel] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const recorder = useRef<VoiceRecorder | null>(null);
  const releasedEarly = useRef(false);
  const supported = isRecordingSupported();

  useEffect(() => () => recorder.current?.cancel(), []);

  useEffect(() => {
    if (phase !== 'recording') return;
    const timer = setInterval(
      () => setSeconds(Math.floor((recorder.current?.elapsedMs ?? 0) / 1000)),
      250,
    );
    return () => clearInterval(timer);
  }, [phase]);

  const fail = (text: string, focusText: boolean) => {
    setMessage(text);
    setPhase('idle');
    if (focusText) onUnavailable();
  };

  const start = async () => {
    if (phase !== 'idle' || disabled) return;
    if (!supported) return fail(t('voice.unsupported'), true);
    setMessage(null);
    setSeconds(0);
    releasedEarly.current = false;
    const rec = new VoiceRecorder(setLevel, () => void stop());
    recorder.current = rec;
    setPhase('starting');
    try {
      await rec.start();
      feedback('tick');
      setPhase('recording');
      // In hold mode the finger may already be up while the permission prompt was open.
      if (releasedEarly.current) void stop();
    } catch (error) {
      recorder.current = null;
      const reason = error instanceof RecorderFailure ? error.reason : 'failed';
      if (reason === 'denied') fail(t('voice.denied'), true);
      else if (reason === 'unsupported') fail(t('voice.unsupported'), true);
      else fail(t('voice.failed'), false);
    }
  };

  const stop = async () => {
    const rec = recorder.current;
    if (!rec) {
      releasedEarly.current = true;
      return;
    }
    recorder.current = null;
    const { blob, durationMs } = await rec.stop();
    if (durationMs < MIN_DURATION_MS || blob.size < 200) {
      fail(t('voice.tooShort'), false);
      return;
    }
    setPhase('transcribing');
    try {
      const { data } = useBill.getState();
      const result = await transcribe(
        blob,
        data.people.map((p) => p.name),
        data.items.map((i) => i.name),
      );
      setPhase('idle');
      if (!result.text.trim()) setMessage(t('voice.nothingHeard'));
      else onTranscript(result.text.trim());
    } catch (error) {
      const code = errorCodeOf(error);
      fail(`${t(`errors.${code}.title`)}. ${t(`errors.${code}.body`)}`, true);
    }
  };

  const recording = phase === 'recording';
  const label =
    phase === 'transcribing'
      ? t('voice.transcribing')
      : recording
        ? mode === 'hold'
          ? t('voice.release')
          : t('voice.tapStop')
        : mode === 'hold'
          ? t('voice.hold')
          : t('voice.tapStart');

  const holdHandlers =
    mode === 'hold'
      ? {
          onPointerDown: (e: React.PointerEvent) => {
            if (e.button !== 0) return;
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
            void start();
          },
          onPointerUp: () => void stop(),
          onPointerCancel: () => void stop(),
          onKeyDown: (e: React.KeyboardEvent) => {
            if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
              e.preventDefault();
              void start();
            }
          },
          onKeyUp: (e: React.KeyboardEvent) => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault();
              void stop();
            }
          },
        }
      : { onClick: () => void (recording ? stop() : start()) };

  return (
    <div className="flex shrink-0 flex-col items-center gap-1">
      <div className="relative">
        <span
          aria-hidden
          className="absolute inset-0 rounded-full bg-primary/30 transition-transform duration-75"
          style={{ transform: `scale(${recording ? 1.1 + level * 0.7 : 1})` }}
        />
        <button
          type="button"
          disabled={disabled || phase === 'transcribing' || phase === 'starting'}
          aria-label={label}
          aria-pressed={recording}
          onContextMenu={(e) => e.preventDefault()}
          {...holdHandlers}
          className={`relative flex size-16 touch-none items-center justify-center rounded-full shadow-card transition-colors select-none disabled:opacity-60 ${
            recording ? 'bg-danger text-white' : 'bg-primary text-primary-fg'
          }`}
          style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none' }}
        >
          {phase === 'transcribing' || phase === 'starting' ? (
            <Loader2 aria-hidden className="size-7 animate-spin" />
          ) : recording ? (
            <Square aria-hidden className="size-6 fill-current" />
          ) : (
            <Mic aria-hidden className="size-7" />
          )}
        </button>
      </div>
      <button
        type="button"
        onClick={() => setMode(mode === 'hold' ? 'tap' : 'hold')}
        className="min-h-8 rounded-lg px-1 text-[0.7rem] font-medium text-muted underline-offset-2 hover:underline"
        aria-label={`${t('voice.modeLabel')}: ${mode === 'hold' ? t('voice.modeHold') : t('voice.modeTap')}`}
      >
        {mode === 'hold' ? t('voice.modeTap') : t('voice.modeHold')}
      </button>
      <div className="sr-only" aria-live="assertive">
        {recording ? t('voice.listening', { seconds }) : ''}
      </div>
      {slot &&
        (recording || message || phase === 'transcribing') &&
        createPortal(
          <MicStatus
            text={
              recording
                ? `${t('voice.listening', { seconds })} · ${t('voice.limit')}`
                : phase === 'transcribing'
                  ? t('voice.transcribing')
                  : message!
            }
            level={recording ? level : null}
            tone={message && !recording ? 'warning' : 'info'}
          />,
          slot,
        )}
    </div>
  );
}

function MicStatus({
  text,
  level,
  tone,
}: {
  text: string;
  level: number | null;
  tone: 'info' | 'warning';
}) {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      className={`rounded-2xl px-3 py-2 text-sm ${
        tone === 'warning' ? 'bg-warning-bg text-warning-fg' : 'bg-surface-2 text-text'
      }`}
    >
      {level !== null && (
        <span
          className="mb-1 flex h-1.5 w-full overflow-hidden rounded-full bg-border"
          role="meter"
          aria-label={t('voice.level')}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(level * 100)}
        >
          <span
            className="h-full rounded-full bg-primary transition-[width] duration-75"
            style={{ width: `${Math.round(level * 100)}%` }}
          />
        </span>
      )}
      {text}
    </div>
  );
}
