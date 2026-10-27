import { m } from 'framer-motion';
import { ArrowRight, Pencil, Plus, Users, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '../../components/Dialog';
import { Screen } from '../../components/Layout';
import { Avatar } from '../../components/Person';
import { Banner, Button, Field, inputClass } from '../../components/ui';
import { initials, PERSON_EMOJIS, personColor } from '../../lib/people';
import { addPerson, MAX_PEOPLE, removePerson, updatePerson } from '../../state/actions';
import { useBill } from '../../state/bill';
import { toast } from '../../state/toasts';
import type { Person } from '../../state/types';
import { getSample } from '../../samples/samples';

function EditPersonDialog({ person, onClose }: { person: Person | null; onClose: () => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState(person?.name ?? '');
  const [emoji, setEmoji] = useState<string | null>(person?.emoji ?? null);

  if (!person) return null;
  const save = (e?: FormEvent) => {
    e?.preventDefault();
    updatePerson(person.id, { name, emoji });
    onClose();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('people.editTitle')}
      footer={
        <Button block onClick={() => save()}>
          {t('common.save')}
        </Button>
      }
    >
      <form onSubmit={save} className="flex flex-col gap-4">
        <Field label={t('people.nameLabel')} htmlFor="edit-person-name">
          <input
            id="edit-person-name"
            className={inputClass}
            value={name}
            maxLength={24}
            autoComplete="off"
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-muted">{t('people.emojiLabel')}</legend>
          <div className="grid grid-cols-7 gap-2">
            <button
              type="button"
              aria-pressed={emoji === null}
              onClick={() => setEmoji(null)}
              className={`flex aspect-square min-h-11 items-center justify-center rounded-2xl border text-xs font-medium ${
                emoji === null ? 'border-primary bg-surface-2' : 'border-border'
              }`}
            >
              <span className="sr-only">{t('people.noEmoji')}</span>
              <Avatar person={{ ...person, emoji: undefined }} size="sm" />
            </button>
            {PERSON_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                aria-pressed={emoji === e}
                onClick={() => setEmoji(e)}
                className={`flex aspect-square min-h-11 items-center justify-center rounded-2xl border text-2xl ${
                  emoji === e ? 'border-primary bg-surface-2' : 'border-border'
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </fieldset>
      </form>
    </Dialog>
  );
}

export function NameTag({
  person,
  onEdit,
  onRemove,
}: {
  person: Person;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  return (
    <m.li
      layout
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.6, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 22 }}
      className="flex items-center rounded-full py-1 pr-1 pl-1 text-person-fg shadow-card"
      style={{ backgroundColor: personColor(person) }}
    >
      <button
        type="button"
        onClick={onEdit}
        aria-label={t('people.edit', { name: person.name })}
        className="flex min-h-11 items-center gap-2 rounded-full pr-2 pl-0.5 focus-visible:outline-[var(--person-fg)]"
      >
        <span className="flex size-9 items-center justify-center rounded-full bg-white/55 font-display text-sm font-semibold">
          {person.emoji ?? initials(person.name)}
        </span>
        <span className="font-display text-lg font-semibold">{person.name}</span>
        <Pencil aria-hidden className="size-3.5 opacity-70" />
      </button>
      <button
        type="button"
        onClick={onRemove}
        aria-label={t('people.remove', { name: person.name })}
        className="flex size-11 items-center justify-center rounded-full hover:bg-white/40 focus-visible:outline-[var(--person-fg)]"
      >
        <X aria-hidden className="size-4" />
      </button>
    </m.li>
  );
}

export function PeopleScreen() {
  const { t } = useTranslation();
  const people = useBill((s) => s.data.people);
  const sampleId = useBill((s) => s.data.sampleId);
  const go = useBill((s) => s.go);
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<Person | null>(null);
  const full = people.length >= MAX_PEOPLE;

  const crew = sampleId ? getSample(sampleId).crew : [];
  const missingCrew = crew.filter(
    (c) => !people.some((p) => p.name.toLocaleLowerCase() === c.toLocaleLowerCase()),
  );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (addPerson(name)) setName('');
    else if (full) toast(t('people.full'), { tone: 'error' });
  };

  const addFriend = () => {
    let n = people.length + 1;
    const names = new Set(people.map((p) => p.name));
    while (names.has(t('people.friendN', { n }))) n++;
    addPerson(t('people.friendN', { n }));
  };

  return (
    <Screen
      step="people"
      title={t('people.title')}
      subtitle={t('people.subtitle')}
      actions={
        <div className="flex items-center gap-3">
          <p className="min-w-0 flex-1 text-sm text-muted">
            {t('people.count', { count: people.length })}
          </p>
          <Button
            size="lg"
            disabled={people.length < 2}
            onClick={() => go('assign')}
            icon={<ArrowRight aria-hidden className="order-last size-5" />}
          >
            {t('people.next')}
          </Button>
        </div>
      }
    >
      <form onSubmit={submit} className="flex gap-2">
        <label htmlFor="person-name" className="sr-only">
          {t('people.nameLabel')}
        </label>
        <input
          id="person-name"
          className={`${inputClass} min-h-12 text-lg`}
          placeholder={t('people.placeholder')}
          value={name}
          maxLength={24}
          autoComplete="off"
          autoCapitalize="words"
          enterKeyHint="done"
          autoFocus={people.length === 0}
          disabled={full}
          onChange={(e) => setName(e.target.value)}
        />
        <Button
          type="submit"
          className="min-h-12"
          disabled={!name.trim() || full}
          icon={<Plus aria-hidden className="size-5" />}
        >
          {t('people.add')}
        </Button>
      </form>

      <div className="flex flex-wrap gap-2">
        {missingCrew.length > 0 && (
          <Button
            variant="secondary"
            icon={<Users aria-hidden className="size-4 text-accent" />}
            onClick={() => missingCrew.forEach((c) => addPerson(c))}
          >
            {t('people.demoCrew')}
          </Button>
        )}
        <Button variant="secondary" onClick={addFriend} disabled={full}>
          {t('people.quickFriend')}
        </Button>
      </div>

      <ul
        className="flex flex-wrap gap-2.5"
        aria-label={t('people.count', { count: people.length })}
      >
        {people.map((person) => (
          <NameTag
            key={person.id}
            person={person}
            onEdit={() => setEditing(person)}
            onRemove={() => {
              removePerson(person.id);
              toast(t('people.removed', { name: person.name }), { undoable: true });
            }}
          />
        ))}
      </ul>

      {people.length < 2 && <Banner tone="info">{t('people.min')}</Banner>}

      {editing && (
        <EditPersonDialog key={editing.id} person={editing} onClose={() => setEditing(null)} />
      )}
    </Screen>
  );
}
