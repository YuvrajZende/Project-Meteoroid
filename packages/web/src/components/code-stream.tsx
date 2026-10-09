"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

const TICK_MS = 16;
const MIN_CHARS_PER_TICK = 6;
/** Long files still finish in roughly this many ticks. */
const MAX_TICKS_PER_FILE = 140;
const PAUSE_TICKS = 18;

/**
 * Replays streamed file contents one file at a time, character by character,
 * so a run looks like it's writing its code live.
 */
export function useCodeStream(order: string[], contents: Record<string, string> | undefined, startTyped: boolean) {
  const queue = useMemo(() => order.filter((p) => contents?.[p] !== undefined), [order, contents]);
  const [pos, setPos] = useState(() => ({ index: startTyped ? Number.MAX_SAFE_INTEGER : 0, chars: 0, pause: 0 }));
  const drained = pos.index >= queue.length;

  useEffect(() => {
    if (drained) return;
    const timer = setInterval(() => {
      setPos((p) => {
        const code = contents?.[queue[p.index]];
        if (code === undefined) return p;
        if (p.chars >= code.length) {
          return p.pause >= PAUSE_TICKS ? { index: p.index + 1, chars: 0, pause: 0 } : { ...p, pause: p.pause + 1 };
        }
        const step = Math.max(MIN_CHARS_PER_TICK, Math.ceil(code.length / MAX_TICKS_PER_FILE));
        return { ...p, chars: Math.min(code.length, p.chars + step + Math.floor(Math.random() * step)) };
      });
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [drained, queue, contents]);

  const path = drained ? undefined : queue[pos.index];
  return {
    drained,
    path,
    typed: path ? (contents?.[path] ?? "").slice(0, pos.chars) : "",
    /** Files the viewer has "seen" written so far */
    visibleFiles: drained ? order : order.filter((p) => !queue.includes(p) || queue.indexOf(p) <= pos.index),
  };
}

export function CodeStream({ path, code }: { path?: string; code: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [code]);

  if (!path) {
    return (
      <p className="flex items-center gap-2 p-4 text-sm text-ink-3">
        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> Agents are writing code…
      </p>
    );
  }

  const lines = code.split("\n");
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b px-3">
        <Loader2 className="size-3.5 shrink-0 animate-spin text-ink-3" aria-hidden="true" />
        <span className="truncate font-mono text-[12px]" translate="no">
          {path}
        </span>
        <span className="ml-auto shrink-0 text-xs text-ink-3 tabular">{lines.length} lines</span>
      </div>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto" aria-live="off">
        <div className="code-view font-mono text-[13px] leading-5" style={{ ["--lines" as string]: String(lines.length).length }}>
          <pre className="shiki">
            <code>
              {lines.map((line, i) => (
                <span key={i} className="line">
                  {line}
                  {i === lines.length - 1 && (
                    <span
                      aria-hidden="true"
                      className="ml-px inline-block h-4 w-[7px] translate-y-[3px] bg-ink"
                      style={{ animation: "caret-blink 1s step-end infinite" }}
                    />
                  )}
                  {"\n"}
                </span>
              ))}
            </code>
          </pre>
        </div>
      </div>
    </div>
  );
}
