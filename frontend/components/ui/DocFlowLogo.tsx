import React from 'react';

interface DocFlowLogoProps {
  /** Size of the square logo mark in px (default 32) */
  size?: number;
  /** Show the wordmark "DocFlow" beside the mark (default true) */
  showWordmark?: boolean;
  /** Text size class for the wordmark (default 'text-base') */
  textSize?: string;
  /** Extra classes on the outer wrapper */
  className?: string;
  /** Variant — 'color' uses brand gradient, 'white' renders everything white (for coloured backgrounds) */
  variant?: 'color' | 'white';
}

/**
 * DocFlow brand logo.
 *
 * The mark is a rounded square containing a stylised ECG/pulse line that
 * flows into a right-pointing arrow — symbolising patient flow and care.
 * Built as an inline SVG so it is theme-aware and requires no image asset.
 */
export function DocFlowLogo({
  size = 32,
  showWordmark = true,
  textSize = 'text-base',
  className = '',
  variant = 'color',
}: DocFlowLogoProps) {
  const isWhite = variant === 'white';

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* ── Logo mark ── */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        role="img"
      >
        {/* Rounded square background */}
        {isWhite ? (
          <rect width="32" height="32" rx="8" fill="white" fillOpacity="0.2" />
        ) : (
          <>
            <defs>
              <linearGradient id="df-bg" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                <stop stopColor="#2563EB" />
                <stop offset="1" stopColor="#0D9488" />
              </linearGradient>
            </defs>
            <rect width="32" height="32" rx="8" fill="url(#df-bg)" />
          </>
        )}

        {/*
          Pulse / flow line:
          Starts flat from left, rises to a sharp ECG spike at centre,
          then flows as a smooth curve into a right-pointing arrowhead.
          All rendered in white for contrast on both light and dark bg.
        */}
        <path
          d="M4 16 H9 L11 11 L14 21 L17 9 L20 16 H24 L27 13"
          stroke="white"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        {/* Arrow head pointing right */}
        <polyline
          points="25,11 28,14 25,17"
          stroke="white"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>

      {/* ── Wordmark ── */}
      {showWordmark && (
        <span
          className={`font-bold leading-none tracking-tight select-none ${textSize} ${
            isWhite
              ? 'text-white'
              : 'text-gray-900 dark:text-white'
          }`}
        >
          DocFlow
        </span>
      )}
    </div>
  );
}

/**
 * Compact icon-only version — no wordmark, useful for collapsed sidebars
 * and favicon contexts.
 */
export function DocFlowIcon({ size = 32, variant = 'color' }: Pick<DocFlowLogoProps, 'size' | 'variant'>) {
  return <DocFlowLogo size={size} showWordmark={false} variant={variant} />;
}

export default DocFlowLogo;
