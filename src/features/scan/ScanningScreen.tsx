import { m } from 'framer-motion';
import { Camera, Keyboard, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ErrorCard } from '../../components/ErrorCard';
import { Button } from '../../components/ui';
import { errorCodeOf, parseReceipt, type ClientErrorCode } from '../../lib/api';
import { usePrefersReducedMotion } from '../../lib/hooks';
import { isAcceptedImage, prepareReceiptImage } from '../../lib/image';
import { billFromReceipt, useBill } from '../../state/bill';
import { startManual, startSample } from '../../state/start';

const MESSAGES = ['scan.reading1', 'scan.reading2', 'scan.reading3'] as const;

function ReceiptIllustration({ sweeping }: { sweeping: boolean }) {
  return (
    <div className="relative mx-auto h-64 w-48" aria-hidden>
      <svg viewBox="0 0 192 256" className="absolute inset-0 h-full w-full drop-shadow-xl">
        <path
          d="M12 8h168v232l-14-8-14 8-14-8-14 8-14-8-14 8-14-8-14 8-14-8-14 8-14-8-14 8z"
          fill="#fffdf8"
          stroke="#e7dccb"
          strokeWidth="2"
        />
        <rect x="56" y="26" width="80" height="10" rx="5" fill="#2a2150" opacity="0.8" />
        {[56, 76, 96, 116, 136, 156].map((y, i) => (
          <g key={y} opacity="0.55">
            <rect
              x="28"
              y={y}
              width={[78, 60, 92, 54, 70, 84][i]}
              height="7"
              rx="3.5"
              fill="#6b6488"
            />
            <rect x="136" y={y} width="28" height="7" rx="3.5" fill="#6b6488" />
          </g>
        ))}
        <rect x="28" y="186" width="136" height="2" fill="#d9cfbf" />
        <rect x="28" y="198" width="50" height="10" rx="5" fill="#2a2150" />
        <rect x="120" y="198" width="44" height="10" rx="5" fill="#c2185b" />
      </svg>
      {sweeping && (
        <div
          className="absolute inset-x-1 top-3 h-1.5 rounded-full bg-gradient-to-r from-[var(--glow-2)] via-[var(--glow-1)] to-[var(--glow-3)] shadow-[0_0_24px_6px_rgba(255,79,139,0.45)]"
          style={{
            animation: 'scan-sweep 2.2s ease-in-out infinite',
            ['--sweep-distance' as string]: '220px',
          }}
        />
      )}
    </div>
  );
}

function ScanAttempt() {
  const { t } = useTranslation();
  const file = useBill((s) => s.pendingImage);
  const { start, go, scan } = useBill.getState();
  const reduced = usePrefersReducedMotion();
  const [error, setError] = useState<ClientErrorCode | null>(null);
  const [message, setMessage] = useState(0);
  const [preparing, setPreparing] = useState(true);
  const retryInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Starting the bill clears the pending photo; nothing more to do then.
    if (!file) return;
    const controller = new AbortController();
    (async () => {
      try {
        const image = await prepareReceiptImage(file);
        if (controller.signal.aborted) return;
        setPreparing(false);
        const receipt = await parseReceipt(image, controller.signal);
        if (controller.signal.aborted) return;
        start(billFromReceipt(receipt, 'scan'), 'review');
      } catch (e) {
        if (!controller.signal.aborted) setError(errorCodeOf(e));
      }
    })();
    return () => controller.abort();
  }, [file, start]);

  useEffect(() => {
    if (error || preparing) return;
    const timer = setInterval(() => setMessage((m) => (m + 1) % MESSAGES.length), 1800);
    return () => clearInterval(timer);
  }, [error, preparing]);

  if (error) {
    return (
      <div className="mx-auto w-full max-w-md flex-1 px-4 py-6">
        <ErrorCard
          code={error}
          actions={
            <>
              <Button
                block
                icon={<Camera aria-hidden className="size-5" />}
                onClick={() => retryInput.current?.click()}
              >
                {t('errors.tryAnother')}
              </Button>
              <Button
                block
                variant="secondary"
                icon={<Keyboard aria-hidden className="size-5" />}
                onClick={startManual}
              >
                {t('errors.manual')}
              </Button>
              <Button
                block
                variant="secondary"
                icon={<Sparkles aria-hidden className="size-5" />}
                onClick={() => startSample('grill')}
              >
                {t('errors.sample')}
              </Button>
            </>
          }
        />
        <input
          ref={retryInput}
          type="file"
          accept="image/*"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            const next = e.target.files?.[0];
            if (next && isAcceptedImage(next)) scan(next);
            e.target.value = '';
          }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-8 px-4 py-10 text-center">
      <ReceiptIllustration sweeping={!reduced} />
      <div aria-live="polite" className="min-h-16">
        <h1 className="font-display text-2xl font-bold">{t('scan.title')}</h1>
        <m.p
          key={preparing ? 'prep' : message}
          initial={reduced ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-1 text-muted"
        >
          {preparing ? t('scan.preparing') : t(MESSAGES[message]!)}
        </m.p>
      </div>
      <Button variant="ghost" onClick={() => go('home')}>
        {t('scan.cancel')}
      </Button>
    </div>
  );
}

/** Each new photo gets a fresh attempt, so error and progress state start clean. */
export function ScanningScreen() {
  const attempt = useBill((s) => s.scanAttempt);
  return <ScanAttempt key={attempt} />;
}
