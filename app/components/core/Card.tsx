import React from 'react';

type CardVariant = 'default' | 'elevated' | 'inset' | 'accent';

const variantClass: Record<CardVariant, string> = {
  default:  'card',
  elevated: 'card-elevated',
  inset:    'card-inset',
  accent:   'card-accent',
};

export default function Card({
  children,
  className = '',
  variant = 'default',
}: {
  children: React.ReactNode;
  className?: string;
  variant?: CardVariant;
}) {
  return (
    <div className={[variantClass[variant], className].join(' ')}>
      {children}
    </div>
  );
}
