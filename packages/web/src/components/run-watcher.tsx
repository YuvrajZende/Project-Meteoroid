"use client";

import { useEffect, useRef } from "react";
import { useGeneration, type RunStatus } from "@/lib/generation";
import { notifyCompletion } from "@/lib/notify";

/**
 * Reflects active builds in the tab title and notifies when a background tab's build finishes.
 */
export function RunWatcher() {
  const { runs } = useGeneration();
  const previous = useRef<Record<string, RunStatus>>({});

  const active = Object.values(runs).filter((r) => r.status === "running").length;

  useEffect(() => {
    const base = document.title.replace(/^● Building(?: \d+)?… · /, "");
    document.title = active ? `● Building${active > 1 ? ` ${active}` : ""}… · ${base}` : base;
  }, [active]);

  useEffect(() => {
    for (const run of Object.values(runs)) {
      const before = previous.current[run.projectId];
      if (before === "running" && run.status !== "running") {
        const href = `/projects/${run.projectId}`;
        if (run.status === "succeeded") notifyCompletion("Backend ready", `${run.projectId} finished building.`, href);
        if (run.status === "failed") notifyCompletion("Build failed", run.error ?? `${run.projectId} failed.`, href);
      }
      previous.current[run.projectId] = run.status;
    }
  }, [runs]);

  return null;
}
