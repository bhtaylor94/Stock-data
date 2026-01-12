import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { tooltipForKey } from '@/lib/tooltipDefs';

type Placement = 'top' | 'bottom' | 'left' | 'right';

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    'ontouchstart' in window ||
    (navigator as any)?.maxTouchPoints > 0 ||
    (navigator as any)?.msMaxTouchPoints > 0
  );
}

export function InfoIcon({ className }: { className?: string }) {
  return (
    <span
      className={
        className ||
        'inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-700/70 text-slate-200 text-[10px] leading-none'
      }
      aria-hidden
    >
      i
    </span>
  );
}

/**
 * Smart tooltip:
 * - never clipped (portal)
 * - auto placement if near edges
 * - hover on desktop, tap-to-toggle on mobile
 */
export function Tooltip({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactElement;
}) {
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number; placement: Placement }>({ x: 0, y: 0, placement: 'top' });

  const touch = useMemo(() => isTouchDevice(), []);

  useEffect(() => {
    setMounted(true);
  }, []);

  function computePosition() {
    const anchor = anchorRef.current;
    const tip = tipRef.current;
    if (!anchor || !tip) return;

    const a = anchor.getBoundingClientRect();
    const t = tip.getBoundingClientRect();
    const pad = 10;

    const spaceRight = window.innerWidth - a.right;
    const spaceLeft = a.left;
    const spaceTop = a.top;
    const spaceBottom = window.innerHeight - a.bottom;

    // Smart placement rules:
    // - If near right edge, prefer left
    // - If near left edge, prefer right
    // - If near top, prefer bottom
    // - Otherwise prefer top
    let placement: Placement = 'top';
    if (spaceRight < 160 && spaceLeft > spaceRight) placement = 'left';
    else if (spaceLeft < 160 && spaceRight > spaceLeft) placement = 'right';
    else if (spaceTop < 120 && spaceBottom > spaceTop) placement = 'bottom';
    else placement = 'top';

    let x = a.left + a.width / 2 - t.width / 2;
    let y = a.top - t.height - 8;

    if (placement === 'bottom') {
      y = a.bottom + 8;
    }
    if (placement === 'left') {
      x = a.left - t.width - 10;
      y = a.top + a.height / 2 - t.height / 2;
    }
    if (placement === 'right') {
      x = a.right + 10;
      y = a.top + a.height / 2 - t.height / 2;
    }

    x = clamp(x, pad, window.innerWidth - t.width - pad);
    y = clamp(y, pad, window.innerHeight - t.height - pad);
    setPos({ x, y, placement });
  }

  useEffect(() => {
    if (!open) return;
    computePosition();

    const onScroll = () => computePosition();
    const onResize = () => computePosition();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const tip = tipRef.current;
      const anchor = anchorRef.current;
      if (!tip || !anchor) return;
      if (tip.contains(e.target as Node)) return;
      if (anchor.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const child = React.cloneElement(children, {
    onMouseEnter: (e: any) => {
      children.props.onMouseEnter?.(e);
      if (!touch) setOpen(true);
    },
    onMouseLeave: (e: any) => {
      children.props.onMouseLeave?.(e);
      if (!touch) setOpen(false);
    },
    onClick: (e: any) => {
      children.props.onClick?.(e);
      if (touch) setOpen(v => !v);
    },
  });

  return (
    <>
      <span ref={anchorRef} className="inline-flex">
        {child}
      </span>
      {mounted && open &&
        createPortal(
          <div
            ref={tipRef}
            role="tooltip"
            className="fixed z-[100] max-w-[280px] rounded-xl border border-slate-700 bg-slate-900/95 px-3 py-2 text-xs text-slate-200 shadow-2xl"
            style={{ left: pos.x, top: pos.y }}
          >
            <div className="text-slate-100">{label}</div>
            <div className="mt-1 text-[10px] text-slate-400">
              {touch ? 'Tap outside to close' : 'Press Esc to close'}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

export function TipLabel({
  labelKey,
  children,
  iconClassName,
}: {
  labelKey: string;
  children: React.ReactNode;
  iconClassName?: string;
}) {
  const def = tooltipForKey(labelKey);
  return (
    <span className="inline-flex items-center gap-1">
      <span>{children}</span>
      {def && (
        <Tooltip
          label={
            <div>
              <div className="font-semibold">{def.title}</div>
              <div className="mt-1 text-slate-200/90">{def.body}</div>
            </div>
          }
        >
          <button type="button" className="inline-flex items-center" aria-label={`What is ${def.title}?`}>
            <InfoIcon className={iconClassName} />
          </button>
        </Tooltip>
      )}
    </span>
  );
}
