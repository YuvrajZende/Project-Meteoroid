"use client";

/*
 * Adapted from Beautiful UI TaskRows (beautifului.dev, MIT, (c) 2026 Shane Levine).
 * One capsule per sub-agent: queued ring → spinning ring → check or cross, with
 * expandable details. Driven by live sub-agent state.
 */

import { useState } from "react";
import type { SubAgent } from "@/lib/generation";
import { formatElapsed } from "./loading-state";

function SpinnerRing({ active, children }: { active?: boolean; children?: React.ReactNode }) {
  const size = 24,
    stroke = 2;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0" style={active ? { animation: "spin 1.1s linear infinite" } : undefined} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line-strong)" strokeWidth={stroke} />
        {active && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${c * 0.28} ${c * 0.72}`}
          />
        )}
      </svg>
      <span className="relative text-[10.5px] font-semibold text-ink tabular-nums">{children}</span>
    </span>
  );
}

function Badge({ tone, children }: { tone: "red" | "green"; children: React.ReactNode }) {
  return (
    <span
      className={`flex size-5.5 shrink-0 items-center justify-center rounded-full text-white ${tone === "red" ? "bg-red" : "bg-green"}`}
      style={{ animation: "pop-in 300ms cubic-bezier(0.23,1,0.32,1) both" }}
    >
      {children}
    </span>
  );
}

const XIcon = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" aria-hidden="true">
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);
const CheckIcon = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

const STATUS_PILL: Record<SubAgent["status"], { label: string; className: string } | null> = {
  queued: { label: "Queued", className: "bg-hover-2 text-ink-2" },
  running: null,
  done: { label: "Done", className: "bg-green-tint text-green" },
  failed: { label: "Failed", className: "bg-red-tint text-red" },
};

function agentLabel(agent: string) {
  if (agent.startsWith("custom-")) return "Your";
  return agent.replace(/-agent$/, "").replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function AgentRows({ agents }: { agents: SubAgent[] }) {
  const [open, setOpen] = useState<Record<number, boolean>>({});

  return (
    <div className="flex w-full flex-col gap-2">
      {agents.map((agent, i) => {
        const isOpen = open[agent.id] ?? false;
        const pill = STATUS_PILL[agent.status];
        const details = [
          { label: "Agent", meta: agent.agent },
          agent.files !== undefined ? { label: "Files produced", meta: String(agent.files) } : null,
          agent.durationMs !== undefined ? { label: "Duration", meta: formatElapsed(agent.durationMs) } : null,
          agent.error ? { label: "Error", meta: agent.error } : null,
        ].filter((d): d is { label: string; meta: string } => d !== null);

        return (
          <div
            key={agent.id}
            className="self-stretch overflow-hidden bg-surface shadow-card transition-[border-radius,background-color] duration-300 hover:bg-inset"
            style={{ borderRadius: isOpen ? 14 : 22, animation: `fade-up 450ms cubic-bezier(0.23,1,0.32,1) ${i * 80}ms both` }}
          >
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpen((cur) => ({ ...cur, [agent.id]: !isOpen }))}
              className="flex min-h-11 w-full items-center gap-2.5 px-2.5 text-left"
            >
              <span className="flex size-6 shrink-0 items-center justify-center">
                {agent.status === "done" ? (
                  <Badge tone="green">{CheckIcon}</Badge>
                ) : agent.status === "failed" ? (
                  <Badge tone="red">{XIcon}</Badge>
                ) : (
                  <SpinnerRing active={agent.status === "running"}>{agent.id + 1}</SpinnerRing>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-ink">{agent.title}</span>
                <span className="block truncate text-[11.5px] text-ink-3">{agentLabel(agent.agent)} agent</span>
              </span>
              {agent.status === "running" && <span className="shimmer text-[12px] font-medium">Writing code…</span>}
              {pill && (
                <span
                  className={`inline-flex h-5.5 shrink-0 items-center rounded-full px-2 text-[11.5px] font-medium ${pill.className}`}
                  style={{ animation: "fade-in 200ms ease-out both" }}
                >
                  {pill.label}
                </span>
              )}
              <span aria-hidden="true" className="-ml-1 flex size-7 shrink-0 items-center justify-center rounded-full text-ink-3">
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="transition-transform duration-300"
                  style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0)" }}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </span>
            </button>
            <div
              className="grid transition-[grid-template-rows,opacity] duration-300"
              style={{ gridTemplateRows: isOpen ? "1fr" : "0fr", opacity: isOpen ? 1 : 0, transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)" }}
            >
              <div className="overflow-hidden">
                <div className="mb-2.5 grid grid-cols-[24px_1fr] gap-2.5 px-2.5">
                  <span aria-hidden className="mx-auto h-full w-px bg-line" />
                  <div className="flex flex-col gap-1.5">
                    {details.map((d, j) => (
                      <div
                        key={d.label}
                        className="flex items-start justify-between gap-4"
                        style={isOpen ? { animation: `fade-up 300ms cubic-bezier(0.23,1,0.32,1) ${120 + j * 100}ms both` } : undefined}
                      >
                        <span className="shrink-0 text-[12px] text-ink-2">{d.label}</span>
                        <span className="min-w-0 text-right font-mono text-[11.5px] break-words text-ink-3 tabular-nums">{d.meta}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
