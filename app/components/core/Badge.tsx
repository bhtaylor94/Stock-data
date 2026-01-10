import React from 'react';
export default function Badge({ text }: { text: string }) {
  return (
    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white/10 border border-white/10">
      {text}
    </span>
  );
}
