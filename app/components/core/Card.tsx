import React from 'react';

export default function Card(props: { children: React.ReactNode; className?: string }) {
  const { children, className = '' } = props;
  return (
    <div className={['rounded-2xl border border-white/10 bg-white/[0.04] shadow-xl backdrop-blur-xl', className].join(' ')}>
      {children}
    </div>
  );
}
