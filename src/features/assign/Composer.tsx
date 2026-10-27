import { Lightbulb, Loader2, SendHorizonal } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Banner, Button, inputClass } from '../../components/ui';
import { assign, errorCodeOf, type ClientErrorCode } from '../../lib/api';
import { feedback } from '../../lib/feedback';
import { getSample } from '../../samples/samples';
import { applyAssignProposal } from '../../state/actions';
import { useBill } from '../../state/bill';
import { MicButton } from './MicButton';
import { ProposalPanel, type ProposalState } from './ProposalPanel';

/** Errors after which the AI is unlikely to work soon — the UI points to manual assigning. */
const AI_DOWN: ClientErrorCode[] = ['NOT_CONFIGURED', 'OFFLINE', 'RATE_LIMITED'];

export function Composer() {
  const { t, i18n } = useTranslation();
  const sampleId = useBill((s) => s.data.sampleId);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ClientErrorCode | null>(null);
  const [proposal, setProposal] = useState<ProposalState | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [statusSlot, setStatusSlot] = useState<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const send = async (utterance: string) => {
    const sentence = utterance.trim();
    if (!sentence || busy) return;
    const { data } = useBill.getState();
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setError(null);
    setProposal(null);
    try {
      const result = await assign(
        {
          utterance: sentence,
          items: data.items.map((i) => ({ id: i.id, name: i.name, quantity: i.quantity })),
          people: data.people.map((p) => ({ id: p.id, name: p.name })),
          currentAssignments: data.assignments,
          language: i18n.language,
        },
        controller.signal,
      );
      setProposal({ utterance: sentence, result, items: data.items, appliedAt: null });
      setText('');
    } catch (e) {
      if (!controller.signal.aborted) setError(errorCodeOf(e));
    } finally {
      if (abortRef.current === controller) setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void send(text);
  };

  const apply = () => {
    if (!proposal) return;
    applyAssignProposal(proposal.result.assignments);
    feedback('assign');
    setProposal({ ...proposal, appliedAt: useBill.getState().past.length });
  };

  const hints = sampleId ? getSample(sampleId).hints : [];

  return (
    <section className="flex flex-col gap-3" aria-label={t('assign.inputLabel')}>
      <form onSubmit={submit} className="flex items-end gap-2">
        <MicButton
          statusSlot={statusSlot}
          disabled={busy}
          onTranscript={(spoken) => {
            setText(spoken);
            void send(spoken);
          }}
          onUnavailable={() => inputRef.current?.focus()}
        />
        <div className="relative min-w-0 flex-1">
          <label htmlFor="assign-input" className="sr-only">
            {t('assign.inputLabel')}
          </label>
          <textarea
            id="assign-input"
            ref={inputRef}
            rows={2}
            value={text}
            maxLength={1000}
            placeholder={t('assign.placeholder')}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send(text);
              }
            }}
            className={`${inputClass} block min-h-16 resize-none py-2.5 pr-14 leading-snug`}
          />
          <button
            type="submit"
            disabled={!text.trim() || busy}
            aria-label={t('assign.send')}
            className="absolute right-1.5 bottom-1.5 flex size-11 items-center justify-center rounded-xl bg-primary text-primary-fg disabled:opacity-40"
          >
            {busy ? (
              <Loader2 aria-hidden className="size-5 animate-spin" />
            ) : (
              <SendHorizonal aria-hidden className="size-5" />
            )}
          </button>
        </div>
      </form>

      <div ref={setStatusSlot} />

      {busy && (
        <p className="flex items-center gap-2 text-sm text-muted" role="status">
          <Loader2 aria-hidden className="size-4 animate-spin" />
          {t('assign.thinking')}
        </p>
      )}

      {hints.length > 0 && !proposal && !busy && (
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-muted">
            <Lightbulb aria-hidden className="size-4 text-accent" />
            {t('assign.hintsTitle')}
          </p>
          <ul className="flex flex-wrap gap-2">
            {hints.map((key) => {
              const hint = t(`samples.${key}` as 'samples.hint1');
              return (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => {
                      setText(hint);
                      void send(hint);
                    }}
                    className="min-h-11 rounded-2xl border border-border bg-surface px-3 py-2 text-left text-sm hover:border-primary"
                  >
                    “{hint}”
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {error && (
        <Banner
          tone="warning"
          title={t(`errors.${error}.title`)}
          action={
            text.trim() && error !== 'NOT_CONFIGURED' ? (
              <Button variant="secondary" onClick={() => void send(text)}>
                {t('errors.retry')}
              </Button>
            ) : undefined
          }
        >
          {AI_DOWN.includes(error) ? t('assign.aiUnavailable') : t(`errors.${error}.body`)}
        </Banner>
      )}

      {proposal && (
        <ProposalPanel
          proposal={proposal}
          onApply={apply}
          onEdit={() => {
            setText(proposal.utterance);
            setProposal(null);
            inputRef.current?.focus();
          }}
          onDismiss={() => setProposal(null)}
        />
      )}
    </section>
  );
}
