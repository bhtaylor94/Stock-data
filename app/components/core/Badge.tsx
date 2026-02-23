import React from 'react';

type BadgeVariant = 'default' | 'bullish' | 'bearish' | 'neutral' | 'info' | 'warning' | 'urgent';

const variantStyles: Record<BadgeVariant, string> = {
  default:  'bg-slate-700/60 text-slate-300 border-slate-600/50',
  bullish:  'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  bearish:  'bg-red-500/15 text-red-400 border-red-500/30',
  neutral:  'bg-amber-500/15 text-amber-400 border-amber-500/30',
  info:     'bg-blue-500/15 text-blue-400 border-blue-500/30',
  warning:  'bg-orange-500/15 text-orange-400 border-orange-500/30',
  urgent:   'bg-red-500/20 text-red-300 border-red-400/50',
};

const dotColor: Record<BadgeVariant, string> = {
  default:  'bg-slate-400',
  bullish:  'bg-emerald-400',
  bearish:  'bg-red-400',
  neutral:  'bg-amber-400',
  info:     'bg-blue-400',
  warning:  'bg-orange-400',
  urgent:   'bg-red-300',
};

export default function Badge({
  text,
  variant = 'default',
  dot = false,
  className = '',
}: {
  text: string;
  variant?: BadgeVariant;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border',
        variantStyles[variant],
        className,
      ].join(' ')}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor[variant]}`} />}
      {text}
    </span>
  );
}
