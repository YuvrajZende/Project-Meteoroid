import { cn } from "@/lib/utils";

/**
 * Meteoroid mark: a rock with two trailing streaks, on an ember tile.
 */
export function Logo({ className, tile = true }: { className?: string; tile?: boolean }) {
  const mark = (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" className={tile ? "size-[62%]" : className}>
      <path d="M3.5 15.5 12 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" opacity=".55" />
      <path d="M7.5 20 14.5 13" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" opacity=".55" />
      <circle cx="16.5" cy="8.5" r="5" fill="currentColor" />
    </svg>
  );
  if (!tile) return mark;
  return (
    <span className={cn("inline-grid shrink-0 place-items-center rounded-[28%] bg-brand text-white", className)} aria-hidden="true">
      {mark}
    </span>
  );
}
