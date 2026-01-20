import React from 'react';

export default function Badge(props: { text: string; className?: string }) {
  const { text, className = '' } = props;
  return (
    <span className={['px-3 py-1 rounded-full text-xs font-semibold bg-white/10 border border-white/10', className].join(' ')}>
      {text}
    </span>
  );
}
