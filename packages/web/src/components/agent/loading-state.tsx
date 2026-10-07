"use client";

/*
 * Adapted from Beautiful UI LoadingState (beautifului.dev, MIT, (c) 2026 Shane Levine).
 * Pixel-grid loader + shimmer label + elapsed timer, driven by a real start time.
 */

import { useEffect, useState } from "react";

const chevron = Array.from({ length: 9 }, (_, i) => {
  const r = Math.floor(i / 3),
    c = i % 3;
  return (c + Math.abs(r - 1)) * 90;
});

const ORBIT_ORDER = [0, 1, 2, 5, 8, 7, 6, 3];
const orbit = Array.from({ length: 9 }, (_, i) => {
  const k = ORBIT_ORDER.indexOf(i);
  return k === -1 ? null : k * 110;
});

const PATTERNS = {
  drive: { delays: chevron as (number | null)[], dur: 650, round: false },
  dots: { delays: chevron as (number | null)[], dur: 650, round: true },
  orbit: { delays: orbit, dur: 950, round: false },
} as const;

export type LoaderVariant = keyof typeof PATTERNS;

export function LoaderGrid({ variant = "drive" }: { variant?: LoaderVariant }) {
  const { delays, dur, round } = PATTERNS[variant];
  return (
    <span aria-hidden className="grid shrink-0 grid-cols-[repeat(3,4px)] gap-[1.5px]">
      {delays.map((delay, index) => (
        <span
          key={index}
          className={`size-[4px] bg-ink ${round ? "rounded-full" : "rounded-[1px]"}`}
          style={{
            opacity: delay === null ? 0.07 : 0.15,
            animation: delay === null ? "none" : `pixel-on ${dur}ms ease-in-out ${delay}ms infinite`,
          }}
        />
      ))}
    </span>
  );
}

export function formatElapsed(ms: number) {
  const total = Math.max(0, ms) / 1000;
  if (total < 60) return `${total.toFixed(1)}s`;
  return `${Math.floor(total / 60)}m ${(total % 60).toFixed(1)}s`;
}

export function useElapsed(startedAt: number, stoppedAt?: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (stoppedAt) return;
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, [stoppedAt]);
  return (stoppedAt ?? now) - startedAt;
}

export function LoadingState({
  label,
  startedAt,
  variant = "drive",
}: {
  label: string;
  startedAt: number;
  variant?: LoaderVariant;
}) {
  const elapsed = useElapsed(startedAt);
  return (
    <div role="status" className="flex w-fit items-center gap-2.5">
      <LoaderGrid variant={variant} />
      <span className="shimmer text-[13px] font-medium">{label}</span>
      <span className="font-mono text-[12px] text-ink-3 tabular-nums">{formatElapsed(elapsed)}</span>
    </div>
  );
}
