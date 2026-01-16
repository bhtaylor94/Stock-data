'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React from 'react';

function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href;
  const base = 'px-3 py-2 rounded-lg text-sm font-semibold transition-colors';
  const cls = active
    ? base + ' bg-slate-800 text-slate-100'
    : base + ' text-slate-300 hover:text-slate-100 hover:bg-slate-900/60';
  return (
    <Link href={href} className={cls}>
      {label}
    </Link>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/85 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center font-black">
              SA
            </div>
            <div>
              <div className="text-sm font-bold leading-none">Strategy Automation</div>
              <div className="text-[11px] text-slate-400">Signals → Gate → Execute → Manage → Reconcile</div>
            </div>
          </div>

          <nav className="flex items-center gap-1">
            <NavLink href="/" label="Console" />
            <NavLink href="/strategies" label="Strategies" />
            <NavLink href="/portfolio" label="Portfolio" />
            <NavLink href="/settings" label="Settings" />
          </nav>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
