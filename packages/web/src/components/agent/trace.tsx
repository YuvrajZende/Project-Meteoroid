"use client";

/*
 * Adapted from Beautiful UI ThinkingState (beautifului.dev, MIT, (c) 2026 Shane Levine).
 * The expandable agent trace, driven by live state instead of a scripted sequence:
 * it opens while working, settles into a summary, and stays expandable.
 */

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

export type TraceRow = {
  key: string;
  primary: string;
  secondary?: string;
  mono?: boolean;
  href?: string;
  /** Steps variant: still in progress */
  pending?: boolean;
};

const DOT_TONES = ["bg-brand", "bg-orange", "bg-green"];

function GlobeDot({ tone }: { tone: string }) {
  return (
    <span className={`flex size-3.5 shrink-0 items-center justify-center rounded-full text-white ${tone}`}>
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <circle cx="12" cy="12" r="9" />
        <path d="M3.5 12h17M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
      </svg>
    </span>
  );
}

const SPARKLE = (fill: string) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill={fill} aria-hidden="true">
    <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" />
  </svg>
);

export function Trace({
  variant,
  working,
  activeLabel,
  doneLabel,
  rows,
  query,
  icon,
  footer,
}: {
  variant: "steps" | "search" | "reasoning";
  working: boolean;
  activeLabel: string;
  doneLabel: string;
  rows: TraceRow[];
  query?: string;
  icon?: ReactNode;
  footer?: ReactNode;
}) {
  const [manualExpanded, setManualExpanded] = useState<boolean | null>(null);
  const expanded = manualExpanded ?? working;
  const traceRef = useRef<HTMLDivElement>(null);
  const [lineHeight, setLineHeight] = useState(0);

  useLayoutEffect(() => {
    if (traceRef.current) setLineHeight(traceRef.current.offsetHeight);
  }, [rows.length, expanded, query]);

  return (
    <div className="flex w-full flex-col">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setManualExpanded((current) => !(current ?? working))}
        className="-mx-1.5 flex w-fit items-center gap-2 rounded-control px-1.5 py-1 transition-colors duration-100 hover:bg-hover-2"
      >
        <span className="flex shrink-0 transition-colors duration-200" style={{ color: working ? "var(--ink-2)" : "var(--ink-3)" }}>
          {icon ?? SPARKLE(working ? "var(--ink-2)" : "var(--ink-3)")}
        </span>
        <span role="status" className="contents">
          {working ? (
            <span className="shimmer text-[13px] font-medium whitespace-nowrap">{activeLabel}</span>
          ) : (
            <span className="text-[13px] font-medium whitespace-nowrap text-ink-2" style={{ animation: "fade-in 350ms ease-out both" }}>
              {doneLabel}
            </span>
          )}
        </span>
        {(rows.length > 0 || query) && (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--ink-3)"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="transition-transform duration-300"
            style={{ transform: expanded ? "rotate(180deg)" : "rotate(0)" }}
            aria-hidden="true"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        )}
      </button>

      <div
        className="grid transition-[grid-template-rows,opacity] duration-400"
        style={{
          gridTemplateRows: expanded ? "1fr" : "0fr",
          opacity: expanded ? 1 : 0,
          transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)",
        }}
      >
        <div className="overflow-hidden">
          <div className="relative mt-1 ml-[5px] pl-4">
            <span
              aria-hidden
              className="absolute left-[3px] w-px bg-line"
              style={{ top: -8, height: lineHeight ? lineHeight - 2 : 0, transition: "height 500ms cubic-bezier(0.23,1,0.32,1)" }}
            />
            <div ref={traceRef} className="flex flex-col gap-1 py-1">
              {query && (
                <div className="flex min-h-6 items-center gap-2 px-1.5" style={{ animation: "fade-up 300ms cubic-bezier(0.23,1,0.32,1) both" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2" strokeLinecap="round" className="shrink-0" aria-hidden="true">
                    <circle cx="11" cy="11" r="7" />
                    <path d="M21 21l-4.3-4.3" />
                  </svg>
                  <span className="text-[12.5px] text-ink-2">{query}</span>
                </div>
              )}
              {rows.map((row, i) => {
                const content = (
                  <>
                    {variant === "search" && <GlobeDot tone={DOT_TONES[i % 3]} />}
                    {variant === "steps" &&
                      (row.pending ? (
                        <span
                          className="size-3 shrink-0 rounded-full border-[1.5px] border-line-strong border-t-ink-2"
                          style={{ animation: "spin 700ms linear infinite" }}
                        />
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      ))}
                    <span
                      className={`min-w-0 text-[12.5px] ${
                        variant === "reasoning" ? "whitespace-normal leading-relaxed text-ink-2" : "truncate font-medium text-ink"
                      } ${variant === "search" ? "underline-offset-2 group-hover:underline" : ""}`}
                    >
                      {row.primary}
                    </span>
                    {row.secondary && (
                      <span className={`ml-auto shrink-0 text-[11.5px] text-ink-3 ${row.mono ? "font-mono" : ""}`}>{row.secondary}</span>
                    )}
                  </>
                );
                const rowClass = "group flex min-h-7 w-full items-center gap-2 rounded-[6px] px-1.5 py-0.5 text-left";
                const animation = { animation: `fade-up 320ms cubic-bezier(0.23,1,0.32,1) ${Math.min(i, 6) * 80}ms both` };
                return row.href ? (
                  <a
                    key={row.key}
                    href={row.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    className={`${rowClass} transition-colors duration-150 hover:bg-hover`}
                    style={animation}
                  >
                    {content}
                  </a>
                ) : (
                  <div key={row.key} className={rowClass} style={animation}>
                    {content}
                  </div>
                );
              })}
              {footer}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
