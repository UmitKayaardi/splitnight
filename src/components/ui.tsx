import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-primary text-primary-fg hover:bg-primary-hover shadow-[0_6px_20px_-6px_var(--glow-1)] disabled:shadow-none',
  secondary: 'bg-surface text-text border border-border hover:bg-surface-2',
  ghost: 'bg-transparent text-text hover:bg-surface-2',
  danger: 'bg-danger-soft text-danger border border-transparent hover:border-danger',
};

const SIZES: Record<Size, string> = {
  md: 'min-h-11 px-4 text-[0.95rem] gap-2 rounded-2xl',
  lg: 'min-h-14 px-6 text-lg gap-3 rounded-[1.25rem]',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    block,
    icon,
    className = '',
    children,
    type = 'button',
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`inline-flex items-center justify-center font-display font-semibold transition-colors duration-150 select-none disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${SIZES[size]} ${block ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
});

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  tone?: 'default' | 'danger';
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, tone = 'default', className = '', children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={`inline-flex size-11 shrink-0 items-center justify-center rounded-2xl transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        tone === 'danger' ? 'text-danger hover:bg-danger-soft' : 'text-text hover:bg-surface-2'
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
});

export function Card({
  children,
  className = '',
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'li' | 'article';
}) {
  return (
    <Tag className={`rounded-3xl border border-border bg-surface shadow-card ${className}`}>
      {children}
    </Tag>
  );
}

export function Banner({
  tone = 'warning',
  title,
  children,
  icon,
  action,
}: {
  tone?: 'warning' | 'info' | 'success' | 'danger';
  title?: ReactNode;
  children?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  const tones = {
    warning: 'bg-warning-bg text-warning-fg',
    info: 'bg-surface-2 text-text',
    success: 'bg-success-soft text-success',
    danger: 'bg-danger-soft text-danger',
  };
  return (
    <div className={`flex gap-3 rounded-2xl px-4 py-3 text-sm ${tones[tone]}`} role="status">
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? 'mt-0.5' : ''}>{children}</div>}
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  );
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  name,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string; disabled?: boolean }>;
  onChange: (value: T) => void;
  name: string;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="sr-only">{label}</legend>
      <div className="flex flex-wrap gap-1 rounded-2xl bg-surface-2 p-1">
        {options.map((option) => {
          const checked = option.value === value;
          return (
            <label
              key={option.value}
              className={`relative flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-xl px-3 text-center text-sm font-medium transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-ring ${
                checked ? 'bg-surface text-text shadow-card' : 'text-muted hover:text-text'
              } ${option.disabled ? 'cursor-not-allowed opacity-50' : ''}`}
            >
              <input
                type="radio"
                className="sr-only"
                name={name}
                value={option.value}
                checked={checked}
                disabled={option.disabled}
                onChange={() => onChange(option.value)}
              />
              {option.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-11 w-[4.25rem] shrink-0 items-center rounded-full p-1 transition-colors ${
        checked ? 'bg-primary' : 'bg-surface-2 border border-border'
      }`}
    >
      <span
        aria-hidden
        className={`size-8 rounded-full bg-surface shadow transition-transform ${checked ? 'translate-x-6' : ''}`}
      />
    </button>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-muted">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-sm text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

/** Input styling without a width, for fields sized by their parent. */
export const inputBase =
  'min-h-11 rounded-2xl border border-border bg-surface px-3.5 text-base text-text placeholder:text-muted/80 focus:border-ring focus:outline-none focus-visible:outline-3 focus-visible:outline-ring';

export const inputClass = `${inputBase} w-full`;
