"use client";

import { Loader2, ScrollText } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { EmptyState } from "@/components/states";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatDuration } from "@/lib/format";
import type { Run } from "@/lib/generation";

function useElapsed(run?: Run) {
  const [now, setNow] = useState(() => Date.now());
  const running = run?.status === "running";
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);
  if (!run) return 0;
  return (run.finishedAt ?? now) - run.startedAt;
}

export function BuildLog({ run, compact = false }: { run?: Run; compact?: boolean }) {
  const elapsed = useElapsed(run);
  const listRef = useRef<HTMLOListElement>(null);
  const count = run?.events.length ?? 0;

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [count]);

  if (!run) {
    return (
      <EmptyState
        icon={ScrollText}
        title="No Live Log"
        description="Build logs stream while a generation runs in this browser session. Regenerate to watch a new build."
      />
    );
  }

  const start = run.startedAt;

  const log = (
    <div className="flex flex-col gap-4">
      {run.status === "failed" && run.error && (
        <Alert variant="destructive">
          <AlertTitle>Generation Failed</AlertTitle>
          <AlertDescription className="whitespace-pre-wrap">{run.error}</AlertDescription>
        </Alert>
      )}
      <div className="overflow-hidden rounded-lg shadow-border">
        <div className="flex h-10 items-center justify-between border-b bg-background-200 px-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-2">
            {run.status === "running" && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
            {run.status === "running" ? "Building…" : `Finished ${run.status === "succeeded" ? "" : `(${run.status})`}`}
          </span>
          <span className="font-mono tabular">{formatDuration(elapsed)}</span>
        </div>
        <ol
          ref={listRef}
          aria-live="polite"
          aria-label="Build events"
          className="max-h-[60vh] overflow-auto bg-background-200 py-2 font-mono text-[13px] leading-6"
        >
          <li className="flex gap-4 px-4">
            <span className="w-14 shrink-0 text-right text-gray-700 tabular">0.0s</span>
            <span className="text-muted-foreground">Request accepted. Analyzing prompt…</span>
          </li>
          {run.events.map((event, i) => (
            <li key={i} className="flex gap-4 px-4">
              <span className="w-14 shrink-0 text-right text-gray-700 tabular">
                {((new Date(event.timestamp).getTime() - start) / 1000).toFixed(1)}s
              </span>
              <span className="min-w-0 break-words">
                {event.type === "fileWritten" ? (
                  <>
                    <span className="text-success">write</span> {event.filePath}
                  </>
                ) : (
                  <>
                    <span className="text-info">{event.phase}</span> {event.message}
                  </>
                )}
              </span>
            </li>
          ))}
          {run.status !== "running" && (
            <li className="flex gap-4 px-4">
              <span className="w-14 shrink-0 text-right text-gray-700 tabular">{(elapsed / 1000).toFixed(1)}s</span>
              <span className={run.status === "succeeded" ? "text-success" : "text-destructive"}>
                {run.status === "succeeded" ? "Done." : run.status === "cancelled" ? "Stopped." : "Failed."}
              </span>
            </li>
          )}
        </ol>
      </div>
      {run.status === "running" && (
        <p className="text-xs text-muted-foreground">
          Generation can take several minutes. You can leave this page; the build keeps running in this tab.
        </p>
      )}
    </div>
  );

  if (!compact) return log;
  return (
    <details className="group rounded-lg" open={run.status === "failed"}>
      <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 rounded-md px-1.5 py-1 text-[13px] font-medium text-ink-2 hover:bg-hover-2 [&::-webkit-details-marker]:hidden">
        <span aria-hidden="true" className="transition-transform group-open:rotate-90">›</span>
        Raw log
        <span className="text-ink-3 tabular">{run.events.length} events</span>
      </summary>
      <div className="mt-3">{log}</div>
    </details>
  );
}