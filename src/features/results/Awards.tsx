import { m } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Avatar } from '../../components/Person';
import { AWARD_EMOJI, type Award } from '../../lib/awards';
import { usePrefersReducedMotion } from '../../lib/hooks';
import type { Person } from '../../state/types';
import { awardDescription, awardTitle } from './awardText';

export function Awards({ awards, people }: { awards: Award[]; people: Person[] }) {
  const { t } = useTranslation();
  const reduced = usePrefersReducedMotion();
  if (awards.length === 0) return null;

  return (
    <section aria-labelledby="awards-title">
      <h2 id="awards-title" className="mb-3 font-display text-2xl font-bold">
        {t('results.awardsTitle')}
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {awards.map((award, i) => {
          const person = people.find((p) => p.id === award.personId);
          if (!person) return null;
          return (
            <m.li
              key={award.id}
              initial={reduced ? false : { opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.25 + i * 0.12, type: 'spring', stiffness: 260, damping: 20 }}
              className="flex items-center gap-3 rounded-3xl border border-border bg-surface p-3 shadow-card"
            >
              <span
                aria-hidden
                className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-2xl"
              >
                {AWARD_EMOJI[award.id]}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-lg leading-tight font-semibold">
                  {awardTitle(t, award.id, award.dish)}
                </span>
                <span className="block text-sm text-muted">
                  {awardDescription(t, award.id, award.dish)}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-center gap-0.5">
                <Avatar person={person} size="sm" />
                <span className="max-w-16 truncate text-xs font-medium">{person.name}</span>
              </span>
            </m.li>
          );
        })}
      </ul>
    </section>
  );
}
