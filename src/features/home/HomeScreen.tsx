import { m } from 'framer-motion';
import {
  ArrowRight,
  Camera,
  ChevronRight,
  ImageUp,
  Keyboard,
  Mic,
  Receipt,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { useRef, useState, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '../../components/Dialog';
import { Logo, Wordmark } from '../../components/Logo';
import { Button } from '../../components/ui';
import { isAcceptedImage } from '../../lib/image';
import { SAMPLES } from '../../samples/samples';
import { hasBillInProgress, useBill } from '../../state/bill';
import { startManual, startSample } from '../../state/start';
import { useHistory } from '../../state/history';
import { toast } from '../../state/toasts';
import { useUi } from '../../state/ui';

export function HomeScreen() {
  const { t } = useTranslation();
  const data = useBill((s) => s.data);
  const scan = useBill((s) => s.scan);
  const go = useBill((s) => s.go);
  const nights = useHistory((s) => s.nights.length);
  const setPrivacyOpen = useUi((s) => s.setPrivacyOpen);
  const setHistoryOpen = useUi((s) => s.setHistoryOpen);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const cameraInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const inProgress = hasBillInProgress(data);

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (!isAcceptedImage(file)) {
      toast(t('errors.UNSUPPORTED_TYPE.body'), { tone: 'error' });
      return;
    }
    scan(file);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const steps = [
    { icon: Receipt, text: t('home.step1') },
    { icon: Mic, text: t('home.step2') },
    { icon: Trophy, text: t('home.step3') },
  ];

  return (
    <div
      className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pb-10 sm:px-6"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragging(false);
      }}
      onDrop={onDrop}
    >
      <section className="flex flex-col items-center pt-6 pb-8 text-center sm:pt-12">
        <m.div
          initial={{ scale: 0.85, opacity: 0, rotate: -8 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 220, damping: 16 }}
        >
          <Logo size={88} className="drop-shadow-[0_10px_30px_rgba(255,79,139,0.35)]" />
        </m.div>
        <h1 className="mt-4 text-5xl sm:text-6xl">
          <Wordmark />
        </h1>
        <p className="mt-2 max-w-sm text-lg text-muted">{t('app.tagline')}</p>
      </section>

      {inProgress && (
        <button
          type="button"
          onClick={() => go(data.people.length >= 2 ? 'assign' : 'review')}
          className="mb-4 flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 text-left shadow-card"
        >
          <span className="flex items-center gap-3">
            <Receipt aria-hidden className="size-5 text-primary" />
            <span className="font-display font-semibold">
              {data.receipt.merchant ?? t('review.merchantFallback')}
            </span>
          </span>
          <span className="flex items-center gap-1 text-sm text-muted">
            {t('common.next')}
            <ChevronRight aria-hidden className="size-4" />
          </span>
        </button>
      )}

      <div
        className={`rounded-[2rem] border-2 border-dashed p-3 transition-colors sm:p-4 ${
          dragging ? 'border-primary bg-primary/5' : 'border-transparent'
        }`}
      >
        <div className="flex flex-col gap-3">
          <Button
            size="lg"
            block
            icon={<Camera aria-hidden className="size-6" />}
            onClick={() => cameraInput.current?.click()}
          >
            <span className="flex flex-col items-start leading-tight">
              <span>{t('home.scan')}</span>
              <span className="font-sans text-sm font-normal opacity-90">{t('home.scanHint')}</span>
            </span>
          </Button>
          <Button
            size="lg"
            variant="secondary"
            block
            icon={<Sparkles aria-hidden className="size-6 text-accent" />}
            onClick={() => setPickerOpen(true)}
          >
            <span className="flex flex-col items-start leading-tight">
              <span>{t('home.sample')}</span>
              <span className="font-sans text-sm font-normal text-muted">
                {t('home.sampleHint')}
              </span>
            </span>
          </Button>
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 pt-1">
            <Button
              variant="ghost"
              icon={<ImageUp aria-hidden className="size-4" />}
              onClick={() => fileInput.current?.click()}
            >
              {dragging ? t('home.drop') : t('home.choosePhoto')}
            </Button>
            <Button
              variant="ghost"
              icon={<Keyboard aria-hidden className="size-4" />}
              onClick={startManual}
            >
              {t('home.manual')}
            </Button>
          </div>
        </div>
        <input
          ref={cameraInput}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          data-testid="camera-input"
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          data-testid="file-input"
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>

      <section className="mt-8" aria-labelledby="how-it-works">
        <h2 id="how-it-works" className="sr-only">
          {t('home.stepsTitle')}
        </h2>
        <ol className="grid grid-cols-3 gap-2">
          {steps.map(({ icon: Icon, text }, i) => (
            <li
              key={text}
              className="flex flex-col items-center gap-2 rounded-2xl bg-surface-2/60 p-3 text-center"
            >
              <span className="flex size-10 items-center justify-center rounded-full bg-surface text-primary shadow-card">
                <Icon aria-hidden className="size-5" />
              </span>
              <span className="text-sm leading-snug">
                <span className="sr-only">{i + 1}. </span>
                {text}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <footer className="mt-8 flex flex-col items-center gap-2 text-center text-sm text-muted">
        {nights > 0 && (
          <Button
            variant="ghost"
            icon={<Trophy aria-hidden className="size-4" />}
            onClick={() => setHistoryOpen(true)}
          >
            {t('history.title')}
          </Button>
        )}
        <p>
          {t('home.privacyLine')}{' '}
          <button
            type="button"
            className="inline-flex min-h-11 items-center font-medium text-primary underline underline-offset-4"
            onClick={() => setPrivacyOpen(true)}
          >
            {t('home.privacyLink')}
          </button>
        </p>
      </footer>

      <Dialog open={pickerOpen} onClose={() => setPickerOpen(false)} title={t('home.pickSample')}>
        <p className="mb-4 text-muted">{t('home.pickSampleHint')}</p>
        <ul className="flex flex-col gap-3">
          {SAMPLES.map((sample) => (
            <li key={sample.id}>
              <button
                type="button"
                onClick={() => {
                  setPickerOpen(false);
                  startSample(sample.id);
                }}
                className="flex w-full items-center gap-4 rounded-2xl border border-border bg-surface p-3 text-left transition-colors hover:border-primary hover:bg-surface-2"
              >
                <img
                  src={`/samples/${sample.id}.svg`}
                  alt=""
                  width={56}
                  height={80}
                  className="h-20 w-14 shrink-0 rounded-lg border border-border bg-white object-cover object-top"
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-lg font-semibold">
                    {sample.receipt.merchant}
                  </span>
                  <span className="block text-sm text-muted">{t(`samples.${sample.id}`)}</span>
                </span>
                <ArrowRight aria-hidden className="size-5 shrink-0 text-muted" />
              </button>
            </li>
          ))}
        </ul>
      </Dialog>
    </div>
  );
}
