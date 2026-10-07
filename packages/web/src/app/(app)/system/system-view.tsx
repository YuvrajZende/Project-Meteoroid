"use client";

import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { ErrorState, PageHeader } from "@/components/states";
import { StatusBadge, type Status } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { API_URL, api } from "@/lib/api";
import { formatDuration } from "@/lib/format";
import { useGeneration } from "@/lib/generation";

function toStatus(value?: string): Status {
  if (!value) return "unknown";
  if (["healthy", "ok", "connected", "up", "ready"].includes(value)) return "healthy";
  if (["degraded", "partial", "warning"].includes(value)) return "degraded";
  if (["unhealthy", "down", "error", "disconnected", "failed"].includes(value)) return "down";
  return "unknown";
}

function Metric({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 p-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="heading-24 tabular">{value}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}

export function SystemView() {
  const { stream } = useGeneration();
  const health = useQuery({ queryKey: ["health-deep"], queryFn: api.deepHealth, refetchInterval: 30_000 });
  const status = useQuery({ queryKey: ["status"], queryFn: api.status, refetchInterval: 30_000 });
  const learning = useQuery({ queryKey: ["learning"], queryFn: api.learningStats });
  const deploy = useQuery({ queryKey: ["deploy-status"], queryFn: api.deploymentStatus });
  const caps = useQuery({ queryKey: ["capabilities"], queryFn: api.capabilities, staleTime: 60_000 });

  const checks = health.data?.checks;
  const services: { name: string; status?: string; detail?: React.ReactNode }[] = [
    {
      name: "API",
      // Reachable API with failing dependencies is degraded, not down.
      status: health.isError ? "down" : health.data && (health.data.status === "healthy" ? "healthy" : "degraded"),
      detail: <span className="font-mono">{API_URL}</span>,
    },
    { name: "Event Stream", status: stream === "open" ? "healthy" : stream === "connecting" ? "degraded" : "down" },
    {
      name: "Supabase",
      status: checks?.supabase?.status,
      detail: checks?.supabase?.error ?? (checks?.supabase?.latency !== undefined && `${checks.supabase.latency} ms`),
    },
    {
      name: "Redis",
      status: checks?.redis?.status,
      detail: checks?.redis?.error ?? (checks?.redis?.latency !== undefined && `${checks.redis.latency} ms`),
    },
    {
      name: "Vector Store",
      status: checks?.vectorStore?.status,
      detail:
        checks?.vectorStore?.error ??
        (checks?.vectorStore?.embeddingsCount !== undefined && `${checks.vectorStore.embeddingsCount} embeddings`),
    },
    {
      name: "Agents",
      status: checks?.agents?.status,
      detail: checks?.agents && `${checks.agents.loaded} of ${checks.agents.total} loaded`,
    },
    {
      name: "AI Models",
      status: caps.data ? (caps.data.models.fast.configured && caps.data.models.power.configured ? "healthy" : "down") : undefined,
      detail:
        caps.data &&
        `${caps.data.gateway ? "OpenRouter single key · " : ""}planner ${caps.data.models.fast.id} · builder ${caps.data.models.power.id}`,
    },
    {
      name: "Deployments",
      status: deploy.data ? (deploy.data.data.configured ? "healthy" : "degraded") : undefined,
      detail: deploy.data && (deploy.data.data.providers.length ? deploy.data.data.providers.join(", ") : "No provider token set"),
    },
  ];

  const refetchAll = () => {
    void health.refetch();
    void status.refetch();
    void learning.refetch();
    void deploy.refetch();
  };

  const l = learning.data?.learning;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="System"
        description="Health of the API and the services it depends on."
        actions={
          <Button variant="outline" onClick={refetchAll} disabled={health.isFetching}>
            <RefreshCw className={health.isFetching ? "animate-spin" : undefined} /> Refresh
          </Button>
        }
      />

      {health.isError && (
        <ErrorState
          title="API unreachable"
          error={`${health.error.message} Start it with “npm run dev” from the repository root.`}
          onRetry={refetchAll}
        />
      )}

      <section aria-labelledby="services-heading" className="flex flex-col gap-3">
        <h2 id="services-heading" className="heading-16">
          Services
        </h2>
        <ul className="divide-y rounded-lg shadow-border" aria-busy={health.isPending}>
          {services.map((s) => (
            <li key={s.name} className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <div className="text-sm font-medium">{s.name}</div>
                {s.detail && <div className="truncate text-xs text-muted-foreground">{s.detail}</div>}
              </div>
              {health.isPending && s.name !== "Event Stream" ? (
                <Skeleton className="h-4 w-16" />
              ) : (
                <StatusBadge status={toStatus(s.status)} />
              )}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="runtime-heading" className="flex flex-col gap-3">
        <h2 id="runtime-heading" className="heading-16">
          Runtime
        </h2>
        <div className="grid divide-y rounded-lg shadow-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <Metric
            label="Uptime"
            value={status.data ? formatDuration(status.data.uptime * 1000) : <Skeleton className="h-8 w-24" />}
            hint={status.data && `${status.data.environment} · v${status.data.version}`}
          />
          <Metric
            label="Memory"
            value={status.data ? `${status.data.memory.percentage}%` : <Skeleton className="h-8 w-16" />}
            hint={
              status.data && (
                <span className="flex flex-col gap-2">
                  <Progress value={status.data.memory.percentage} aria-label="Heap usage" className="h-1" />
                  {status.data.memory.used}&nbsp;MB of {status.data.memory.total}&nbsp;MB heap
                </span>
              )
            }
          />
          <Metric
            label="Agents"
            value={status.data ? status.data.agents.loaded : <Skeleton className="h-8 w-12" />}
            hint={status.data && `${status.data.agents.capabilities.length} capabilities`}
          />
        </div>
      </section>

      {l && (
        <section aria-labelledby="learning-heading" className="flex flex-col gap-3">
          <h2 id="learning-heading" className="heading-16">
            Learning
          </h2>
          <div className="grid divide-y rounded-lg shadow-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <Metric label="Generations" value={l.totalIterations} hint={`${l.failedIterations} failed`} />
            <Metric label="Success Rate" value={`${Math.round(l.successRate * (l.successRate <= 1 ? 100 : 1))}%`} />
            <Metric label="Patterns Learned" value={l.patternsLearned} />
          </div>
        </section>
      )}
    </div>
  );
}
