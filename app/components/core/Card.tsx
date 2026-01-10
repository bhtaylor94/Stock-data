import React from 'react';
export default function Card({ children, className = '' }: { children: React.ReactNode; className?: string; }) {
  return (
    <div className={"rounded-2xl border border-white/10 bg-white/[0.04] shadow-xl backdrop-blur-xl " + className}>
      {children}
    </div>
  );
}
