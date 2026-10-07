"use client";

import { Check, FileCode2, Globe } from "lucide-react";
import { Orb, type OrbVariant } from "@/components/aicss/Orb";
import type { Run } from "@/lib/generation";
import { cn } from "@/lib/utils";
import { AgentRows } from "./agent-rows";
import { formatElapsed, LoadingState, useElapsed } from "./loading-state";
import { Trace, type TraceRow } from "./trace";

type StageKey = "think" | "research" | "build" | "write";

const STAGES: { key: StageKey; label: string; orb: OrbVariant; active: string }[] = [
  { key: "think", label: "Think", orb: "S1", active: "Thinking" },
  { key: "research", label: "Research", orb: "B2", active: "Searching the web" },
  { key: "build", label: "Build", orb: "B5", active: "Routing sub-agents" },
  { key: "write", label: "Write", orb: "C5", active: "Writing files" },
];

function currentStage(run: Run): StageKey {
  if (run.files.length) return "write";
  if (run.agents.some((a) => a.status !== "queued")) return "build";
  if (run.tools.some((t) => t.status === "running")) return "research";
  if (run.agents.length) return run.tools.length ? "build" : "build";
  return "think";
}

function hostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function Stepper({ run, stage }: { run: Run; stage: StageKey }) {
  const running = run.status === "running";
  const order = STAGES.map((s) => s.key);
  const currentIndex = order.indexOf(stage);
  const skipped = (key: StageKey) => key === "research" && !run.tools.length && (currentIndex > 1 || !running);

  return (
    <ol className="flex flex-wrap items-center gap-1.5" aria-label="Generation stages">
      {STAGES.map((s, i) => {
        const done = !running ? run.status === "succeeded" || i < currentIndex : i < currentIndex;
        const active = running && i === currentIndex;
        return (
          <li key={s.key} className="flex items-center gap-1.5">
            <span
              className={cn(
                "inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium transition-colors duration-300",
                active && "bg-brand-tint text-brand-ink",
                done && !skipped(s.key) && "bg-green-tint text-green",
                (!active && !done) || skipped(s.key) ? "bg-hover text-ink-3" : "",
              )}
              aria-current={active ? "step" : undefined}
            >
              {done && !skipped(s.key) && <Check className="size-3" aria-hidden="true" />}
              {s.label}
              {skipped(s.key) && <span className="sr-only">(skipped)</span>}
            </span>
            {i < STAGES.length - 1 && <span aria-hidden="true" className="h-px w-3 bg-line-strong sm:w-6" />}
          </li>
        );
      })}
    </ol>
  );
}

export function ActivityFeed({ run }: { run: Run }) {
  const running = run.status === "running";
  const stage = currentStage(run);
  const stageMeta = STAGES.find((s) => s.key === stage)!;
  const elapsed = useElapsed(run.startedAt, run.finishedAt);

  const thinkingSteps: TraceRow[] = run.events
    .filter((e) => e.type === "pipelineStep" && (e.phase === "init" || e.phase === "thinking" || e.phase === "intent"))
    .map((e, i, all) => ({
      key: `${i}-${e.message}`,
      primary: e.message ?? "",
      pending: running && run.thinking?.status !== "done" && i === all.length - 1,
    }));
  const thinkingWorking = running && (run.thinking?.status === "active" || (!run.thinking && !run.agents.length));
  const thinkingSeconds = run.thinking?.durationMs ? Math.max(1, Math.round(run.thinking.durationMs / 1000)) : null;

  const fileRows: TraceRow[] = run.files.map((path) => ({ key: path, primary: path, mono: true }));
  const writing = running && run.files.length > 0;

  return (
    <div className="@container flex flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-window bg-surface p-4 shadow-card @2xl:flex-row @2xl:items-center @2xl:justify-between">
        <div className="flex items-center gap-3">
          {running ? (
            <Orb variant={stageMeta.orb} size={28} />
          ) : (
            <span
              className={cn(
                "flex size-7 items-center justify-center rounded-full text-white",
                run.status === "succeeded" ? "bg-green" : run.status === "failed" ? "bg-red" : "bg-ink-3",
              )}
              style={{ animation: "pop-in 300ms cubic-bezier(0.23,1,0.32,1) both" }}
            >
              {run.status === "succeeded" ? <Check className="size-4" /> : <span className="text-sm font-bold">!</span>}
            </span>
          )}
          <div className="min-w-0">
            {running ? (
              <LoadingState label={`${stageMeta.active}…`} startedAt={run.startedAt} variant={stage === "write" ? "orbit" : "drive"} />
            ) : (
              <p className="text-[13px] font-medium text-ink">
                {run.status === "succeeded"
                  ? `Built in ${formatElapsed(elapsed)}`
                  : run.status === "cancelled"
                    ? "Stopped"
                    : "Generation failed"}
              </p>
            )}
            <p className="mt-0.5 text-[12px] text-ink-3 tabular-nums">
              {run.agents.length} sub-agent{run.agents.length === 1 ? "" : "s"} · {run.tools.length} tool call
              {run.tools.length === 1 ? "" : "s"} · {run.files.length} file{run.files.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        <Stepper run={run} stage={stage} />
      </div>

      <section aria-label="Reasoning" className="flex flex-col gap-1">
        <Trace
          variant="steps"
          working={thinkingWorking}
          activeLabel="Thinking"
          doneLabel={
            thinkingSeconds
              ? `Thought for ${thinkingSeconds}s${run.thinking?.complexity ? ` · ${run.thinking.complexity} complexity` : ""}`
              : "Analyzed the request"
          }
          rows={thinkingSteps}
          footer={
            run.thinking?.summary && !thinkingWorking ? (
              <p className="px-1.5 text-[12px] text-ink-3" style={{ animation: "fade-in 300ms ease-out both" }}>
                {run.thinking.summary}
              </p>
            ) : undefined
          }
        />
      </section>

      {run.tools.map((tool) => (
        <section key={tool.id} aria-label="Web search" className="flex flex-col gap-1">
          <Trace
            variant="search"
            working={tool.status === "running"}
            icon={<Globe className="size-4" aria-hidden="true" />}
            activeLabel="Searching the web"
            doneLabel={
              tool.status === "error"
                ? "Web search unavailable"
                : `Read ${tool.results?.length ?? 0} source${tool.results?.length === 1 ? "" : "s"}${
                    tool.durationMs ? ` in ${formatElapsed(tool.durationMs)}` : ""
                  }`
            }
            query={tool.query}
            rows={(tool.results ?? []).map((r) => ({ key: r.url, primary: r.title, secondary: hostname(r.url), href: r.url }))}
            footer={
              tool.error ? (
                <p className="px-1.5 text-[12px] text-red" style={{ animation: "fade-in 300ms ease-out both" }}>
                  {tool.error}
                </p>
              ) : undefined
            }
          />
        </section>
      ))}

      {run.agents.length > 0 && (
        <section aria-labelledby="subagents-heading" className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            {running && stage === "build" && <Orb variant="B5" size={16} />}
            <h3 id="subagents-heading" className="text-[13px] font-medium text-ink-2">
              {running && stage !== "write"
                ? `Allocated ${run.agents.length} sub-agent${run.agents.length === 1 ? "" : "s"}`
                : `${run.agents.filter((a) => a.status === "done").length} of ${run.agents.length} sub-agents finished`}
            </h3>
          </div>
          <AgentRows agents={run.agents} />
        </section>
      )}

      {run.files.length > 0 && (
        <section aria-label="Files written" className="flex flex-col gap-1">
          <Trace
            variant="steps"
            working={writing}
            icon={<FileCode2 className="size-4" aria-hidden="true" />}
            activeLabel={`Writing files · ${run.files.length}`}
            doneLabel={`Wrote ${run.files.length} file${run.files.length === 1 ? "" : "s"}`}
            rows={fileRows}
          />
        </section>
      )}
    </div>
  );
}
