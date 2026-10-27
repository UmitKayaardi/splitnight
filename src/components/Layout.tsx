import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useBill } from '../state/bill';
import { canEnter } from '../state/flow';
import { FLOW_STEPS, type FlowStep } from '../state/types';

export function StepIndicator({ current }: { current: FlowStep }) {
  const { t } = useTranslation();
  const data = useBill((s) => s.data);
  const go = useBill((s) => s.go);
  const index = FLOW_STEPS.indexOf(current);
  const names: Record<FlowStep, string> = {
    review: t('steps.scan'),
    people: t('steps.people'),
    assign: t('steps.assign'),
    extras: t('steps.extras'),
    results: t('steps.results'),
  };

  return (
    <nav
      aria-label={t('steps.progress', {
        current: index + 1,
        total: FLOW_STEPS.length,
        name: names[current],
      })}
    >
      <ol className="flex items-center gap-1">
        {FLOW_STEPS.map((step, i) => {
          const done = i < index;
          const active = i === index;
          const reachable = !active && canEnter(step, data);
          return (
            <li key={step} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <button
                type="button"
                disabled={!reachable}
                onClick={() => go(step)}
                aria-current={active ? 'step' : undefined}
                aria-label={active ? names[step] : t('steps.goTo', { name: names[step] })}
                className="group flex min-h-11 w-full flex-col items-center justify-center gap-1 rounded-xl disabled:cursor-default"
              >
                <span
                  aria-hidden
                  className={`flex h-2 w-full items-center rounded-full transition-colors ${
                    active ? 'bg-primary' : done ? 'bg-primary/55' : 'bg-surface-2'
                  }`}
                />
                <span
                  className={`flex items-center gap-0.5 truncate text-[0.72rem] font-medium sm:text-xs ${
                    active ? 'text-text' : 'text-muted'
                  }`}
                >
                  {done && <Check aria-hidden className="size-3" />}
                  {names[step]}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function Screen({
  title,
  subtitle,
  step,
  children,
  actions,
  aside,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  step?: FlowStep;
  children: ReactNode;
  /** Primary actions, pinned to the bottom of the screen on phones. */
  actions?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 sm:px-6">
      {step && (
        <div className="pt-1 pb-3">
          <StepIndicator current={step} />
        </div>
      )}
      <header className="pt-2 pb-4">
        <h1 className="font-display text-[1.9rem] leading-tight font-bold sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
      </header>
      {aside}
      <div className="flex flex-1 flex-col gap-4 pb-6">{children}</div>
      {actions && (
        <div className="safe-bottom sticky bottom-0 z-20 -mx-4 mt-auto border-t border-border bg-bg/90 px-4 pt-3 backdrop-blur-md sm:mx-0 sm:rounded-t-3xl sm:border-x">
          {actions}
        </div>
      )}
    </div>
  );
}
