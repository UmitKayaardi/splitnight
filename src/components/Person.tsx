import { initials, personColor } from '../lib/people';
import type { Person } from '../state/types';

export function Avatar({
  person,
  size = 'md',
  ring = false,
}: {
  person: Person;
  size?: 'sm' | 'md' | 'lg';
  ring?: boolean;
}) {
  const sizes = { sm: 'size-7 text-[0.7rem]', md: 'size-9 text-sm', lg: 'size-12 text-lg' };
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-display font-semibold text-person-fg ${sizes[size]} ${
        ring ? 'ring-2 ring-surface' : ''
      }`}
      style={{ backgroundColor: personColor(person) }}
    >
      {person.emoji ?? initials(person.name)}
    </span>
  );
}

export function AvatarStack({ people, max = 4 }: { people: Person[]; max?: number }) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <span className="flex -space-x-2">
      {shown.map((p) => (
        <Avatar key={p.id} person={p} size="sm" ring />
      ))}
      {extra > 0 && (
        <span
          aria-hidden
          className="inline-flex size-7 items-center justify-center rounded-full bg-surface-2 text-[0.7rem] font-semibold ring-2 ring-surface"
        >
          +{extra}
        </span>
      )}
    </span>
  );
}
