"use client";

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import { API_URL, ApiError, api } from "./api";
import type { ActivityEvent, ExecuteRequest, ExecuteResponse, PipelineEvent } from "./types";

export type RunStatus = "running" | "succeeded" | "failed" | "cancelled";
export type StreamStatus = "connecting" | "open" | "offline";

export interface ToolCall {
  id: string;
  tool: "web_search";
  status: "running" | "done" | "error";
  query: string;
  results?: { title: string; url: string }[];
  error?: string;
  durationMs?: number;
  startedAt: number;
}

export interface SubAgent {
  id: number;
  title: string;
  agent: string;
  status: "queued" | "running" | "done" | "failed";
  files?: number;
  error?: string;
  durationMs?: number;
}

export interface Thinking {
  status: "active" | "done";
  startedAt: number;
  summary?: string;
  complexity?: string;
  durationMs?: number;
}

export interface Run {
  projectId: string;
  prompt: string;
  /** Simulated run (no model or search calls) */
  demo?: boolean;
  status: RunStatus;
  startedAt: number;
  finishedAt?: number;
  events: PipelineEvent[];
  files: string[];
  /** Contents of files written so far, when the server streamed them inline */
  contents?: Record<string, string>;
  thinking?: Thinking;
  tools: ToolCall[];
  agents: SubAgent[];
  result?: ExecuteResponse;
  error?: string;
}

interface State {
  runs: Record<string, Run>;
  stream: StreamStatus;
}

type Listener = () => void;

const HISTORY_KEY = "meteoroid.runs";
const MAX_HISTORY = 20;

function loadHistory(): Record<string, Run> {
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return {};
    const runs = JSON.parse(raw) as Record<string, Run>;
    // A run that was in flight when the tab closed can't be resumed.
    for (const run of Object.values(runs)) {
      if (run.status === "running") Object.assign(run, { status: "cancelled", finishedAt: run.finishedAt ?? Date.now() });
    }
    return runs;
  } catch {
    return {};
  }
}

function saveHistory(runs: Record<string, Run>) {
  try {
    const finished = Object.values(runs)
      .filter((r) => r.status !== "running")
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, MAX_HISTORY)
      // Generated code is fetched from the API; don't duplicate it in storage.
      .map((r) => ({
        ...r,
        contents: undefined,
        result: r.result && { ...r.result, generatedCode: undefined },
      }));
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(Object.fromEntries(finished.map((r) => [r.projectId, r]))));
  } catch {
    // Storage full or unavailable; history is a convenience.
  }
}

class GenerationStore {
  private state: State = { runs: {}, stream: "connecting" };
  private listeners = new Set<Listener>();
  private controllers = new Map<string, AbortController>();
  private runStreams = new Map<string, EventSource>();
  private source: EventSource | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private subscribers = 0;
  private hydrated = false;

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getState = () => this.state;

  private set(next: Partial<State>) {
    this.state = { ...this.state, ...next };
    this.listeners.forEach((l) => l());
  }

  private patchRun(projectId: string, patch: Partial<Run> | ((run: Run) => Partial<Run>)) {
    const run = this.state.runs[projectId];
    if (!run) return;
    const changes = typeof patch === "function" ? patch(run) : patch;
    this.set({ runs: { ...this.state.runs, [projectId]: { ...run, ...changes } } });
  }

  connect() {
    if (!this.hydrated) {
      this.hydrated = true;
      this.set({ runs: { ...loadHistory(), ...this.state.runs } });
    }
    this.subscribers += 1;
    if (this.source || this.subscribers > 1) return;
    this.openStatusStream();
  }

  disconnect() {
    this.subscribers = Math.max(0, this.subscribers - 1);
    if (this.subscribers > 0) return;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.source?.close();
    this.source = null;
  }

  /** Global stream, used only to show API connectivity. */
  private openStatusStream() {
    const source = new EventSource(`${API_URL}/api/v1/events`);
    this.source = source;
    this.set({ stream: "connecting" });
    source.addEventListener("open", () => this.set({ stream: "open" }));
    source.addEventListener("error", () => {
      if (source.readyState === EventSource.CLOSED) {
        this.source = null;
        this.set({ stream: "offline" });
        this.retryTimer = setTimeout(() => this.subscribers > 0 && this.openStatusStream(), 3000);
      } else {
        this.set({ stream: "connecting" });
      }
    });
  }

  /**
   * Per-project stream carrying this run's pipeline steps, files and agent activity.
   * Resolves once connected (or after a short timeout) so the run doesn't miss early events.
   */
  private async openRunStream(projectId: string): Promise<void> {
    let ticket: string;
    try {
      ({ ticket } = await api.streamTicket(projectId));
    } catch {
      return; // Live activity is a nicety; the run itself still works.
    }
    const url = new URL(`${API_URL}/api/v1/events/projects/${encodeURIComponent(projectId)}`);
    url.searchParams.set("ticket", ticket);
    const source = new EventSource(url);
    this.runStreams.set(projectId, source);
    const connected = new Promise<void>((resolve) => {
      source.addEventListener("connected", () => resolve(), { once: true });
      source.addEventListener("error", () => resolve(), { once: true });
      setTimeout(resolve, 3000);
    });
    // A ticket is single-use, so stop the browser from silently reconnecting with it.
    source.addEventListener("error", () => source.readyState === EventSource.CONNECTING && source.close());

    const parse = <T,>(message: MessageEvent<string>): T | null => {
      try {
        return JSON.parse(message.data) as T;
      } catch {
        return null;
      }
    };

    const onStep = (type: PipelineEvent["type"]) => (message: MessageEvent<string>) => {
      const data = parse<Omit<PipelineEvent, "type">>(message);
      if (!data || data.projectId !== projectId) return;
      const { content, ...rest } = data;
      const event: PipelineEvent = { ...rest, type };
      this.patchRun(projectId, (run) => ({
        events: [...run.events, event],
        contents:
          type === "fileWritten" && data.filePath && content !== undefined
            ? { ...run.contents, [data.filePath]: content }
            : run.contents,
        files:
          type === "fileWritten" && data.filePath && !run.files.includes(data.filePath)
            ? [...run.files, data.filePath]
            : run.files,
      }));
    };

    source.addEventListener("pipelineStep", onStep("pipelineStep"));
    source.addEventListener("fileWritten", onStep("fileWritten"));
    source.addEventListener("activity", (message: MessageEvent<string>) => {
      const data = parse<ActivityEvent>(message);
      if (!data || data.projectId !== projectId) return;
      this.patchRun(projectId, (run) => applyActivity(run, data));
    });
    await connected;
  }

  private closeRunStream(projectId: string) {
    this.runStreams.get(projectId)?.close();
    this.runStreams.delete(projectId);
  }

  async start(request: Omit<ExecuteRequest, "projectId">): Promise<string> {
    const projectId = createProjectId(request.prompt);
    const controller = new AbortController();
    this.controllers.set(projectId, controller);
    this.set({
      runs: {
        ...this.state.runs,
        [projectId]: {
          projectId,
          prompt: request.prompt,
          demo: !!request.config?.demo,
          status: "running",
          startedAt: Date.now(),
          events: [],
          files: [],
          tools: [],
          agents: [],
        },
      },
    });
    void this.openRunStream(projectId).then(() => this.execute(projectId, request, controller));
    return projectId;
  }

  private execute(projectId: string, request: Omit<ExecuteRequest, "projectId">, controller: AbortController) {
    if (controller.signal.aborted) {
      this.patchRun(projectId, { status: "cancelled", finishedAt: Date.now() });
      this.closeRunStream(projectId);
      return;
    }
    api
      .execute({ ...request, projectId }, controller.signal)
      .then((result) => {
        const ok = result.success || !!result.isQuestion;
        this.patchRun(projectId, (run) => ({
          status: ok ? "succeeded" : "failed",
          result,
          finishedAt: Date.now(),
          error: ok ? undefined : result.errors?.join("\n") || "Generation failed",
          thinking: run.thinking && { ...run.thinking, status: "done" },
          tools: run.tools.map((t) => (t.status === "running" ? { ...t, status: "error" } : t)),
          agents: run.agents.map((a) =>
            a.status === "queued" || a.status === "running" ? { ...a, status: ok ? "done" : "failed" } : a,
          ),
        }));
      })
      .catch((error: unknown) => {
        const cancelled = error instanceof DOMException && error.name === "AbortError";
        this.patchRun(projectId, (run) => ({
          status: cancelled ? "cancelled" : "failed",
          finishedAt: Date.now(),
          error: cancelled ? undefined : error instanceof ApiError ? error.message : String(error),
          thinking: run.thinking && { ...run.thinking, status: "done" },
        }));
      })
      .finally(() => {
        this.controllers.delete(projectId);
        // Let trailing events land before closing the stream.
        setTimeout(() => this.closeRunStream(projectId), 1500);
        saveHistory(this.state.runs);
      });
  }

  cancel(projectId: string) {
    this.controllers.get(projectId)?.abort();
  }

  forget(projectId: string) {
    const runs = { ...this.state.runs };
    delete runs[projectId];
    this.set({ runs });
    saveHistory(runs);
  }
}

function applyActivity(run: Run, event: ActivityEvent): Partial<Run> {
  const now = Date.now();
  switch (event.kind) {
    case "thinking":
      return event.status === "start"
        ? { thinking: { status: "active", startedAt: now } }
        : {
            thinking: {
              status: "done",
              startedAt: run.thinking?.startedAt ?? now,
              summary: event.summary,
              complexity: event.complexity,
              durationMs: event.durationMs,
            },
          };
    case "plan":
      return {
        agents: event.subtasks.map((s) => ({ id: s.id, title: s.title, agent: s.agent, status: "queued" as const })),
      };
    case "tool": {
      const existing = run.tools.find((t) => t.id === event.id);
      const next: ToolCall = {
        id: event.id,
        tool: event.tool,
        status: event.status,
        query: event.query,
        results: event.results,
        error: event.error,
        durationMs: event.durationMs,
        startedAt: existing?.startedAt ?? now,
      };
      return { tools: existing ? run.tools.map((t) => (t.id === event.id ? next : t)) : [...run.tools, next] };
    }
    case "agent":
      return {
        agents: run.agents.some((a) => a.id === event.id)
          ? run.agents.map((a) =>
              a.id === event.id
                ? { ...a, status: event.status, files: event.files, error: event.error, durationMs: event.durationMs }
                : a,
            )
          : [...run.agents, { id: event.id, title: `Subtask ${event.id + 1}`, agent: event.agent, status: event.status }],
      };
  }
}

const STOP_WORDS = new Set([
  "a", "an", "the", "make", "create", "build", "develop", "generate", "write", "me", "my", "for", "with",
  "and", "using", "please", "simple", "basic", "new", "project", "app", "api", "backend", "that", "to", "of",
]);

/**
 * Readable slug plus a random suffix, so project IDs (and their event streams) can't be guessed.
 */
export function createProjectId(prompt: string) {
  const words = (prompt.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((w) => w.length > 2 && !STOP_WORDS.has(w));
  const slug = words.slice(0, 2).join("-").slice(0, 40) || "project";
  const random = Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => (b % 36).toString(36)).join("");
  return `${slug}-${random}`;
}

const GenerationContext = createContext<GenerationStore | null>(null);

export function GenerationProvider({ children }: { children: React.ReactNode }) {
  const store = useMemo(() => new GenerationStore(), []);

  useEffect(() => {
    store.connect();
    return () => store.disconnect();
  }, [store]);

  return <GenerationContext.Provider value={store}>{children}</GenerationContext.Provider>;
}

function useStore() {
  const store = useContext(GenerationContext);
  if (!store) throw new Error("useGeneration must be used inside GenerationProvider");
  return store;
}

const SERVER_STATE: State = { runs: {}, stream: "connecting" };

export function useGeneration() {
  const store = useStore();
  const state = useSyncExternalStore(store.subscribe, store.getState, () => SERVER_STATE);
  return {
    runs: state.runs,
    stream: state.stream,
    start: (req: Omit<ExecuteRequest, "projectId">) => store.start(req),
    cancel: (projectId: string) => store.cancel(projectId),
    forget: (projectId: string) => store.forget(projectId),
  };
}

export function useRun(projectId: string): Run | undefined {
  const store = useStore();
  return useSyncExternalStore(
    store.subscribe,
    () => store.getState().runs[projectId],
    () => undefined,
  );
}
