import { motion } from 'framer-motion';
import { Dices, PartyPopper, RotateCcw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '../../components/Dialog';
import { Avatar } from '../../components/Person';
import { Button, Segmented, Switch } from '../../components/ui';
import type { RouletteStake } from '../../lib/money';
import { availableModes, bestOfThreeLoser, type GameMode } from '../../lib/roulette';
import { setRoulette } from '../../state/actions';
import { useBill } from '../../state/bill';
import { computeBill, hasDesserts } from '../../state/derive';
import { toast } from '../../state/toasts';
import { CardsGame, CoinGame, DiceGame, WheelGame } from './games';
import { stakeShort } from './stake';

const GAMES: Record<GameMode, typeof WheelGame> = {
  wheel: WheelGame,
  cards: CardsGame,
  coin: CoinGame,
  dice: DiceGame,
};

/** Bill Roulette: a playful way to decide who covers part of the bill. Nobody is charged. */
export default function RouletteDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const data = useBill((s) => s.data);
  const players = data.people;
  const result = useMemo(() => computeBill({ ...data, roulette: null }), [data]);
  const desserts = hasDesserts(data);
  const tipService = result.serviceMinor + result.tipMinor > 0;

  const [stake, setStake] = useState<RouletteStake>('all');
  const [mode, setMode] = useState<GameMode>('wheel');
  const [bestOf3, setBestOf3] = useState(false);
  const [phase, setPhase] = useState<'setup' | 'play' | 'between' | 'result'>('setup');
  const [round, setRound] = useState(1);
  const [losses, setLosses] = useState<Record<string, number>>({});
  const [roundLoser, setRoundLoser] = useState<string | null>(null);
  const [loser, setLoser] = useState<string | null>(null);

  const modes = availableModes(players.length);
  const modeLabels: Record<GameMode, string> = {
    wheel: t('roulette.modeWheel'),
    cards: t('roulette.modeCards'),
    coin: t('roulette.modeCoin'),
    dice: t('roulette.modeDice'),
  };
  const nameOf = (id: string | null) => players.find((p) => p.id === id)?.name ?? '';
  const Game = GAMES[mode];

  const start = () => {
    setLosses({});
    setRound(1);
    setLoser(null);
    setRoundLoser(null);
    setPhase('play');
  };

  const onRoundEnd = (id: string) => {
    if (!bestOf3) {
      setLoser(id);
      setPhase('result');
      return;
    }
    const next = { ...losses, [id]: (losses[id] ?? 0) + 1 };
    setLosses(next);
    setRoundLoser(id);
    const finalLoser = bestOfThreeLoser(next);
    if (finalLoser) {
      setLoser(finalLoser);
      setPhase('result');
    } else {
      setPhase('between');
    }
  };

  const apply = () => {
    if (!loser) return;
    setRoulette({ loserId: loser, stake });
    toast(t('roulette.applied'), { tone: 'success', undoable: true });
    onClose();
  };

  return (
    <Dialog open onClose={onClose} title={t('roulette.title')} wide>
      <p className="-mt-1 mb-4 rounded-xl bg-accent-soft px-3 py-2 text-sm font-medium text-accent">
        {t('roulette.disclaimer')}
      </p>

      {phase === 'setup' && (
        <div className="flex flex-col gap-5">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 font-display text-lg font-semibold">
              {t('roulette.stakesTitle')}
            </legend>
            {(
              [
                { value: 'all', label: t('roulette.stakeAll'), disabled: false, why: '' },
                {
                  value: 'tipService',
                  label: t('roulette.stakeTipService'),
                  disabled: !tipService,
                  why: t('roulette.noTipService'),
                },
                {
                  value: 'desserts',
                  label: t('roulette.stakeDesserts'),
                  disabled: !desserts,
                  why: t('roulette.noDesserts'),
                },
              ] as const
            ).map((option) => (
              <label
                key={option.value}
                title={option.disabled ? option.why : undefined}
                className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border px-3 py-2 ${
                  stake === option.value ? 'border-primary bg-surface-2' : 'border-border'
                } ${option.disabled ? 'cursor-not-allowed opacity-60' : ''}`}
              >
                <input
                  type="radio"
                  name="stake"
                  className="size-5 accent-[var(--primary)]"
                  checked={stake === option.value}
                  disabled={option.disabled}
                  onChange={() => setStake(option.value)}
                />
                <span className="flex flex-col">
                  <span className="font-medium">{option.label}</span>
                  {option.disabled && <span className="text-sm text-muted">{option.why}</span>}
                </span>
              </label>
            ))}
          </fieldset>

          <div className="flex flex-col gap-2">
            <h3 className="font-display text-lg font-semibold">{t('roulette.modeTitle')}</h3>
            <Segmented
              name="game-mode"
              label={t('roulette.modeTitle')}
              value={mode}
              onChange={setMode}
              options={modes.map((m) => ({ value: m, label: modeLabels[m] }))}
            />
            {players.length !== 2 && (
              <p className="text-sm text-muted">{t('roulette.coinOnlyTwo')}</p>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 rounded-2xl border border-border p-3">
            <span>
              <span className="block font-medium">{t('roulette.bestOf3')}</span>
              <span className="block text-sm text-muted">{t('roulette.bestOf3Hint')}</span>
            </span>
            <Switch label={t('roulette.bestOf3')} checked={bestOf3} onChange={setBestOf3} />
          </div>

          <Button size="lg" block icon={<Dices aria-hidden className="size-5" />} onClick={start}>
            {t('roulette.start')}
          </Button>
        </div>
      )}

      {(phase === 'play' || phase === 'between') && (
        <div className="flex flex-col gap-4">
          {bestOf3 && (
            <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
              <span className="font-display font-semibold">
                {t('roulette.round', { n: round })}
              </span>
              {players.map((p) => (
                <span key={p.id} className="rounded-full bg-surface-2 px-2.5 py-1">
                  {t('roulette.score', { name: p.name, count: losses[p.id] ?? 0 })}
                </span>
              ))}
            </div>
          )}
          {phase === 'play' ? (
            <Game key={`${mode}-${round}`} players={players} onRoundEnd={onRoundEnd} />
          ) : (
            <div
              className="flex flex-col items-center gap-4 py-6 text-center"
              aria-live="assertive"
            >
              <p className="font-display text-2xl font-semibold">
                {t('roulette.roundLoser', { name: nameOf(roundLoser), n: round })}
              </p>
              <Button
                size="lg"
                onClick={() => {
                  setRound((r) => r + 1);
                  setPhase('play');
                }}
              >
                {t('roulette.nextRound')}
              </Button>
            </div>
          )}
        </div>
      )}

      {phase === 'result' && loser && (
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex flex-col items-center gap-4 py-4 text-center"
          aria-live="assertive"
        >
          <PartyPopper aria-hidden className="size-10 text-accent" />
          {players.find((p) => p.id === loser) && (
            <Avatar person={players.find((p) => p.id === loser)!} size="lg" />
          )}
          <p className="font-display text-3xl font-bold">
            {t('roulette.result', { name: nameOf(loser) })}
          </p>
          <p className="text-lg text-muted">
            {t('roulette.resultStake', { name: nameOf(loser), stake: stakeShort(t, stake) })}
          </p>
          <div className="flex w-full flex-col gap-2">
            <Button size="lg" block onClick={apply}>
              {t('roulette.applyToSplit')}
            </Button>
            <Button variant="secondary" block onClick={onClose}>
              {t('roulette.justForFun')}
            </Button>
            <Button
              variant="ghost"
              block
              icon={<RotateCcw aria-hidden className="size-4" />}
              onClick={() => setPhase('setup')}
            >
              {t('roulette.playAgain')}
            </Button>
          </div>
        </motion.div>
      )}
    </Dialog>
  );
}
