import { useId } from 'react';

/**
 * SplitNight mark: a crescent moon cut in two by a dashed line, with a couple of stars.
 * Original artwork; the same shapes are used for the favicon and PWA icons.
 */
export function Logo({ size = 40, className = '' }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`${id}bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#241a5c" />
          <stop offset="1" stopColor="#3b1f6e" />
        </linearGradient>
        <linearGradient id={`${id}moon`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffb547" />
          <stop offset="1" stopColor="#ff4f8b" />
        </linearGradient>
        <mask id={`${id}cut`}>
          <rect width="64" height="64" fill="#fff" />
          <circle cx="40" cy="24" r="14" fill="#000" />
        </mask>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#${id}bg)`} />
      <circle cx="29" cy="34" r="18" fill={`url(#${id}moon)`} mask={`url(#${id}cut)`} />
      <path
        d="M13 50 L35 17"
        stroke={`url(#${id}bg)`}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="4 4"
      />
      <path
        d="M48 38 l1.6 3.4 3.4 1.6 -3.4 1.6 -1.6 3.4 -1.6 -3.4 -3.4 -1.6 3.4 -1.6z"
        fill="#fff4dc"
      />
      <circle cx="51" cy="15" r="1.8" fill="#fff4dc" />
      <circle cx="44" cy="54" r="1.2" fill="#fff4dc" opacity="0.8" />
    </svg>
  );
}

export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`font-display font-bold tracking-tight ${className}`}>
      Split<span className="text-primary">Night</span>
    </span>
  );
}
