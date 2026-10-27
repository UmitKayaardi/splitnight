import { useState, type InputHTMLAttributes } from 'react';
import { minorToInput, parseMoneyInput } from '../lib/money';
import { inputBase } from './ui';

interface MoneyInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type'
> {
  valueMinor: number | null;
  currency: string;
  /** Called on blur or Enter with a valid amount (or null when the field is empty). */
  onCommit: (minor: number | null) => void;
  invalid?: boolean;
}

/** Free-text price field that accepts "4.50", "4,50" or "£4.5" and commits minor units. */
export function MoneyInput({
  valueMinor,
  currency,
  onCommit,
  invalid,
  className = 'w-full',
  ...rest
}: MoneyInputProps) {
  const display = valueMinor === null ? '' : minorToInput(valueMinor, currency);
  const [text, setText] = useState(display);
  // Re-sync when the value changes from outside (undo, another field), during render.
  const [shown, setShown] = useState(display);
  if (shown !== display) {
    setShown(display);
    setText(display);
  }

  const commit = () => {
    const parsed = parseMoneyInput(text, currency);
    if (text.trim() === '') onCommit(null);
    else if (parsed !== null) onCommit(parsed);
    else setText(valueMinor === null ? '' : minorToInput(valueMinor, currency));
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
        }
      }}
      aria-invalid={invalid || undefined}
      className={`${inputBase} tabular text-right ${invalid ? 'border-danger' : ''} ${className}`}
      {...rest}
    />
  );
}
