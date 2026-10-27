import { animate, motion, useMotionValue } from 'framer-motion';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/ui';
import { feedback } from '../../lib/feedback';
import { usePrefersReducedMotion } from '../../lib/hooks';
import { initials, personColor } from '../../lib/people';
import { randomInt } from '../../lib/random';
import {
  drawLoser,
  lowestRollers,
  placeLosingCard,
  rollAll,
  wheelRotation,
} from '../../lib/roulette';
import type { Person } from '../../state/types';

export interface GameProps {
  players: Person[];
  onRoundEnd: (loserId: string) => void;
}

const DIE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

function slicePath(index: number, count: number, r: number): string {
  const a0 = (index / count) * 2 * Math.PI - Math.PI / 2;
  const a1 = ((index + 1) / count) * 2 * Math.PI - Math.PI / 2;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M0 0 L${r * Math.cos(a0)} ${r * Math.sin(a0)} A${r} ${r} 0 ${large} 1 ${r * Math.cos(a1)} ${r * Math.sin(a1)} Z`;
}

export function WheelGame({ players, onRoundEnd }: GameProps) {
  const { t } = useTranslation();
  const reduced = usePrefersReducedMotion();
  const rotation = useMotionValue(0);
  const [spinning, setSpinning] = useState(false);
  const [landed, setLanded] = useState<string | null>(null);
  const lastSlice = useRef(-1);
  const n = players.length;
  const R = 140;

  const spin = () => {
    const loser = drawLoser(players.map((p) => p.id));
    const index = players.findIndex((p) => p.id === loser);
    setSpinning(true);
    setLanded(null);
    if (reduced) {
      rotation.set(wheelRotation(index, n, 0));
      setLanded(loser);
      feedback('reveal');
      setTimeout(() => onRoundEnd(loser), 900);
      return;
    }
    const start = rotation.get() % 360;
    rotation.set(start);
    const target = start - (start % 360) + wheelRotation(index, n, 6, (randomInt(61) - 30) / 100);
    animate(rotation, target, {
      duration: 4.6,
      ease: [0.12, 0.8, 0.22, 1],
      onUpdate: (value) => {
        const slice = Math.floor((((360 - (value % 360)) % 360) / 360) * n);
        if (slice !== lastSlice.current) {
          lastSlice.current = slice;
          feedback('tick');
        }
      },
      onComplete: () => {
        setLanded(loser);
        feedback('reveal');
        setTimeout(() => onRoundEnd(loser), 900);
      },
    });
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <svg
          viewBox="-150 -158 300 308"
          className="w-[min(78vw,300px)]"
          role="img"
          aria-label={t('roulette.modeWheel')}
        >
          <motion.g style={{ rotate: rotation }}>
            {players.map((p, i) => {
              const mid = ((i + 0.5) / n) * 360;
              const won = landed === p.id;
              return (
                <g key={p.id}>
                  <path
                    d={slicePath(i, n, R)}
                    fill={personColor(p)}
                    stroke="#1a1033"
                    strokeWidth={won ? 4 : 1.5}
                  />
                  <text
                    transform={`rotate(${mid}) translate(0 ${-R * 0.62}) rotate(${mid > 90 && mid < 270 ? 180 : 0})`}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#1a1033"
                    fontFamily="Fredoka, sans-serif"
                    fontWeight={600}
                    fontSize={n > 6 ? 13 : 16}
                  >
                    {p.name.length > 10 ? `${p.name.slice(0, 9)}…` : p.name}
                  </text>
                </g>
              );
            })}
          </motion.g>
          <circle r="20" fill="#1a1033" stroke="#fff4dc" strokeWidth="3" />
          <text textAnchor="middle" dominantBaseline="central" fontSize="18">
            🌙
          </text>
          <path d="M-13 -156 L13 -156 L0 -132 Z" fill="#fff4dc" stroke="#1a1033" strokeWidth="2" />
        </svg>
      </div>
      <Button size="lg" onClick={spin} disabled={spinning}>
        {spinning ? t('roulette.spinning') : t('roulette.spin')}
      </Button>
    </div>
  );
}

export function CardsGame({ players, onRoundEnd }: GameProps) {
  const { t } = useTranslation();
  const [losingCard] = useState(() => placeLosingCard(players.length));
  const [revealed, setRevealed] = useState<Record<number, string>>({});
  const [turn, setTurn] = useState(0);
  const [done, setDone] = useState(false);
  const current = players[turn];

  const pickCard = (index: number) => {
    if (done || revealed[index] || !current) return;
    setRevealed((r) => ({ ...r, [index]: current.id }));
    if (index === losingCard) {
      setDone(true);
      feedback('reveal');
      setTimeout(() => onRoundEnd(current.id), 1100);
    } else {
      feedback('pop');
      setTurn((x) => x + 1);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="font-display text-xl font-semibold" aria-live="polite">
        {done
          ? t('roulette.youPay')
          : current
            ? t('roulette.pickCard', { name: current.name })
            : ''}
      </p>
      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {players.map((_, index) => {
          const owner = players.find((p) => p.id === revealed[index]);
          const isLoser = owner && index === losingCard;
          return (
            <li key={index}>
              <motion.button
                type="button"
                onClick={() => pickCard(index)}
                disabled={!!owner || done}
                aria-label={
                  owner
                    ? `${owner.name}: ${isLoser ? t('roulette.youPay') : t('roulette.safe')}`
                    : t('roulette.cardLabel', { n: index + 1 })
                }
                animate={{ rotateY: owner ? 180 : 0 }}
                transition={{ duration: 0.45 }}
                style={{ transformStyle: 'preserve-3d' }}
                className="relative h-28 w-20 rounded-2xl"
              >
                <span
                  className="absolute inset-0 flex items-center justify-center rounded-2xl border-2 border-[#fff4dc]/40 bg-gradient-to-br from-[#3b1f6e] to-[#140f2e] text-3xl shadow-card"
                  style={{ backfaceVisibility: 'hidden' }}
                >
                  🌙
                </span>
                <span
                  className={`absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-2xl p-1 text-center text-person-fg shadow-card ${
                    isLoser ? 'bg-[var(--glow-1)]' : 'bg-[#b9e36f]'
                  }`}
                  style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                >
                  <span className="text-2xl">{isLoser ? '🎯' : '😌'}</span>
                  <span className="text-xs leading-tight font-bold">
                    {isLoser ? t('roulette.youPay') : t('roulette.safe')}
                  </span>
                  <span className="max-w-full truncate text-[0.7rem]">{owner?.name}</span>
                </span>
              </motion.button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function CoinGame({ players, onRoundEnd }: GameProps) {
  const { t } = useTranslation();
  const reduced = usePrefersReducedMotion();
  const [flipping, setFlipping] = useState(false);
  const [side, setSide] = useState<0 | 1 | null>(null);
  const [a, b] = players as [Person, Person];

  const flip = () => {
    const loser = drawLoser([a.id, b.id]);
    const result = loser === a.id ? 0 : 1;
    setFlipping(true);
    setTimeout(
      () => {
        setSide(result);
        feedback('reveal');
        setTimeout(() => onRoundEnd(loser), 900);
      },
      reduced ? 100 : 1600,
    );
  };

  const shown = side === null ? null : side === 0 ? a : b;
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-center text-sm text-muted">
        {t('roulette.heads', { name: a.name })}
        <br />
        {t('roulette.tails', { name: b.name })}
      </p>
      <motion.div
        animate={flipping && side === null && !reduced ? { rotateY: [0, 1800] } : { rotateY: 0 }}
        transition={{ duration: 1.6, ease: 'easeOut' }}
        className="flex size-36 items-center justify-center rounded-full border-4 border-[#fff4dc] font-display text-4xl font-bold text-person-fg shadow-card"
        style={{
          background: shown ? personColor(shown) : 'linear-gradient(135deg,#ffb547,#ff4f8b)',
        }}
      >
        {shown ? initials(shown.name) : '🌙'}
      </motion.div>
      <Button size="lg" onClick={flip} disabled={flipping}>
        {flipping ? t('roulette.flipping') : t('roulette.flip')}
      </Button>
    </div>
  );
}

export function DiceGame({ players, onRoundEnd }: GameProps) {
  const { t } = useTranslation();
  const reduced = usePrefersReducedMotion();
  const [rolling, setRolling] = useState(false);
  const [contenders, setContenders] = useState(players.map((p) => p.id));
  const [rolls, setRolls] = useState<Record<string, number>>({});
  const [tie, setTie] = useState<string[] | null>(null);

  const roll = () => {
    setRolling(true);
    setTie(null);
    feedback('roll');
    setTimeout(
      () => {
        const result = rollAll(contenders);
        setRolls((r) => ({ ...r, ...result }));
        setRolling(false);
        const lowest = lowestRollers(result);
        if (lowest.length === 1) {
          feedback('reveal');
          setContenders([]);
          setTimeout(() => onRoundEnd(lowest[0]!), 1100);
        } else {
          setTie(lowest);
          setContenders(lowest);
        }
      },
      reduced ? 50 : 900,
    );
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-center text-sm text-muted">{t('roulette.lowestLoses')}</p>
      <ul className="grid w-full grid-cols-2 gap-2 sm:grid-cols-3">
        {players.map((p) => {
          const value = rolls[p.id];
          const active = contenders.includes(p.id);
          return (
            <li
              key={p.id}
              className={`flex items-center gap-2 rounded-2xl border p-2 ${active ? 'border-primary' : 'border-border opacity-70'}`}
            >
              <span
                className="flex size-8 items-center justify-center rounded-full font-display text-xs font-semibold text-person-fg"
                style={{ backgroundColor: personColor(p) }}
              >
                {initials(p.name)}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.name}</span>
              <motion.span
                aria-label={value ? t('roulette.rolled', { name: p.name, value }) : undefined}
                animate={rolling && active && !reduced ? { rotate: [0, 360, 720] } : { rotate: 0 }}
                transition={{ duration: 0.9 }}
                className="text-4xl leading-none"
              >
                {value ? DIE_FACES[value - 1] : '🎲'}
              </motion.span>
            </li>
          );
        })}
      </ul>
      {tie && (
        <p className="font-medium text-accent" aria-live="polite">
          {t('roulette.tie', {
            names: tie.map((id) => players.find((p) => p.id === id)?.name).join(', '),
          })}
        </p>
      )}
      <Button size="lg" onClick={roll} disabled={rolling || contenders.length === 0}>
        {rolling ? t('roulette.rolling') : t('roulette.roll')}
      </Button>
    </div>
  );
}
