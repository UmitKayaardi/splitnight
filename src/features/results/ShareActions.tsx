import { Copy, ImageDown, Loader2, Share2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/ui';
import type { Award } from '../../lib/awards';
import type { SplitResult } from '../../lib/money';
import { toast } from '../../state/toasts';
import type { Person } from '../../state/types';
import { ShareCard } from './ShareCard';

async function renderCard(node: HTMLElement): Promise<Blob> {
  // html-to-image is only needed here, so it is loaded on demand.
  const { toBlob } = await import('html-to-image');
  const blob = await toBlob(node, { pixelRatio: 2, cacheBust: true });
  if (!blob) throw new Error('render failed');
  return blob;
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function ShareActions({
  summary,
  people,
  result,
  awards,
  currency,
  rouletteLine,
}: {
  summary: string;
  people: Person[];
  result: SplitResult;
  awards: Award[];
  currency: string;
  rouletteLine: string | null;
}) {
  const { t } = useTranslation();
  const cardRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const fileName = `splitnight-${new Date().toISOString().slice(0, 10)}.png`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(summary);
      toast(t('results.copied'), { tone: 'success' });
    } catch {
      toast(t('results.copyFailed'), { tone: 'error' });
    }
  };

  const saveCard = async () => {
    if (!cardRef.current) return;
    setSaving(true);
    try {
      download(await renderCard(cardRef.current), fileName);
      toast(t('results.cardSaved'), { tone: 'success' });
    } catch {
      toast(t('results.cardFailed'), { tone: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const share = async () => {
    try {
      let files: File[] = [];
      if (cardRef.current) {
        try {
          const file = new File([await renderCard(cardRef.current)], fileName, {
            type: 'image/png',
          });
          if (navigator.canShare?.({ files: [file] })) files = [file];
        } catch {
          // Share the text on its own if the image cannot be made.
        }
      }
      await navigator.share(files.length ? { text: summary, files } : { text: summary });
    } catch (error) {
      if ((error as DOMException)?.name !== 'AbortError')
        toast(t('results.shareFailed'), { tone: 'error' });
    }
  };

  return (
    <section className="flex flex-col gap-2">
      <div className={`grid gap-2 ${canShare ? 'grid-cols-3' : 'grid-cols-2'}`}>
        <Button
          variant="secondary"
          icon={<Copy aria-hidden className="size-4" />}
          onClick={copy}
          className="px-2 text-sm"
        >
          {t('results.copy')}
        </Button>
        <Button
          variant="secondary"
          icon={
            saving ? (
              <Loader2 aria-hidden className="size-4 animate-spin" />
            ) : (
              <ImageDown aria-hidden className="size-4" />
            )
          }
          onClick={saveCard}
          disabled={saving}
          className="px-2 text-sm"
        >
          {saving ? t('results.savingCard') : t('results.saveCard')}
        </Button>
        {canShare && (
          <Button
            variant="secondary"
            icon={<Share2 aria-hidden className="size-4" />}
            onClick={share}
            className="px-2 text-sm"
          >
            {t('results.share')}
          </Button>
        )}
      </div>
      {/* Off-screen copy of the card for rendering to PNG. */}
      <div aria-hidden className="pointer-events-none fixed top-0 -left-[10000px]">
        <ShareCard
          ref={cardRef}
          people={people}
          result={result}
          awards={awards}
          currency={currency}
          rouletteLine={rouletteLine}
        />
      </div>
    </section>
  );
}
