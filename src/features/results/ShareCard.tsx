import { forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Logo } from '../../components/Logo';
import { AWARD_EMOJI, type Award } from '../../lib/awards';
import { initials, personColor } from '../../lib/people';
import { formatMoney, localeTag, type SplitResult } from '../../lib/money';
import type { Person } from '../../state/types';
import { awardTitle } from './awardText';

/**
 * The designed summary card that "Save summary card" turns into a PNG.
 * Always drawn in the night palette so it looks the same whatever the theme.
 */
export const ShareCard = forwardRef<
  HTMLDivElement,
  {
    people: Person[];
    result: SplitResult;
    awards: Award[];
    currency: string;
    rouletteLine: string | null;
  }
>(function ShareCard({ people, result, awards, currency, rouletteLine }, ref) {
  const { t, i18n } = useTranslation();
  const money = (minor: number) => formatMoney(minor, currency, i18n.language);
  const date = new Intl.DateTimeFormat(localeTag(i18n.language), { dateStyle: 'long' }).format(
    new Date(),
  );

  return (
    <div
      ref={ref}
      style={{
        width: 480,
        padding: 32,
        borderRadius: 32,
        background: 'radial-gradient(120% 70% at 100% 0%, #3b1f6e 0%, #140f2e 55%, #0d0a20 100%)',
        color: '#f6f3ff',
        fontFamily: "'Inter Variable', system-ui, sans-serif",
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Logo size={44} />
        <div>
          <div
            style={{
              fontFamily: 'Fredoka, sans-serif',
              fontWeight: 700,
              fontSize: 24,
              lineHeight: 1,
            }}
          >
            Split<span style={{ color: '#ff6fa3' }}>Night</span>
          </div>
          <div style={{ fontSize: 13, color: '#bdb6df', marginTop: 4 }}>{date}</div>
        </div>
      </div>

      <div style={{ marginTop: 28, textAlign: 'center' }}>
        <div style={{ fontSize: 14, color: '#bdb6df' }}>
          {t('results.friends', { count: people.length })}
        </div>
        <div
          style={{
            fontFamily: 'Fredoka, sans-serif',
            fontWeight: 700,
            fontSize: 52,
            lineHeight: 1.1,
          }}
        >
          {money(result.billTotalMinor)}
        </div>
      </div>

      <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {people.map((person) => {
          const total = result.people.find((b) => b.personId === person.id)?.totalMinor ?? 0;
          return (
            <div
              key={person.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                background: 'rgba(255,255,255,0.06)',
                borderRadius: 18,
                padding: '10px 14px',
              }}
            >
              <span
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 999,
                  background: personColor(person),
                  color: '#1a1033',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'Fredoka, sans-serif',
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                {person.emoji ?? initials(person.name)}
              </span>
              <span style={{ flex: 1, fontSize: 18, fontWeight: 600 }}>{person.name}</span>
              <span style={{ fontFamily: 'Fredoka, sans-serif', fontWeight: 600, fontSize: 20 }}>
                {money(total)}
              </span>
            </div>
          );
        })}
      </div>

      {rouletteLine && (
        <div style={{ marginTop: 16, textAlign: 'center', fontSize: 15, color: '#ffc15e' }}>
          {rouletteLine}
        </div>
      )}

      {awards.length > 0 && (
        <div
          style={{
            marginTop: 20,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            justifyContent: 'center',
          }}
        >
          {awards.map((award) => {
            const name = people.find((p) => p.id === award.personId)?.name ?? '';
            return (
              <span
                key={award.id}
                style={{
                  background: 'rgba(255,193,94,0.14)',
                  color: '#ffdf9e',
                  borderRadius: 999,
                  padding: '6px 12px',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {AWARD_EMOJI[award.id]} {awardTitle(t, award.id, award.dish)} · {name}
              </span>
            );
          })}
        </div>
      )}

      <div style={{ marginTop: 24, textAlign: 'center', fontSize: 12, color: '#8f88b8' }}>
        {t('results.summaryFooter')}
      </div>
    </div>
  );
});
