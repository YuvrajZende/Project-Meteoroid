"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Globe, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { AgentAvatar } from "@/components/agent-avatar";
import { EmptyState, ErrorState, PageHeader } from "@/components/states";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import type { CustomAgent } from "@/lib/types";
import { AgentEditor } from "./agent-editor";

const TIER_LABELS: Record<number, string> = { 1: "Core", 2: "Support", 3: "Specialized" };

function BuiltInAgents() {
  const agents = useQuery({ queryKey: ["agents"], queryFn: api.agents });
  if (agents.isError) return <ErrorState title="Couldn’t load built-in agents" error={agents.error} onRetry={() => void agents.refetch()} />;
  if (agents.isPending) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-20 rounded-card" />
        ))}
      </div>
    );
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {agents.data.agents.map((agent, i) => (
        <li
          key={agent.id}
          className="flex items-start gap-3 rounded-card bg-surface p-3.5 shadow-hairline"
          style={{ animation: `fade-up 350ms cubic-bezier(0.23,1,0.32,1) ${Math.min(i, 10) * 30}ms both` }}
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-[30%] bg-hover-2 text-ink-2">
            <Bot className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h3 className="truncate text-[14px] font-medium">{agent.name}</h3>
              <span className="shrink-0 text-[11.5px] text-ink-3">{TIER_LABELS[agent.tier] ?? `Tier ${agent.tier}`}</span>
            </div>
            <p className="mt-0.5 truncate text-[12.5px] text-ink-3">
              {agent.capabilities.slice(0, 3).join(" · ")}
              {agent.capabilities.length > 3 && ` +${agent.capabilities.length - 3}`}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function CustomAgentCard({ agent, onEdit, index }: { agent: CustomAgent; onEdit: () => void; index: number }) {
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: () => api.deleteCustomAgent(agent.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["custom-agents"] });
      toast.success(`${agent.name} deleted`);
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <li
      className="group flex flex-col gap-3 rounded-[14px] bg-surface p-4 shadow-card transition-shadow hover:shadow-raised"
      style={{ animation: `fade-up 400ms cubic-bezier(0.23,1,0.32,1) ${index * 50}ms both` }}
    >
      <div className="flex items-start gap-3">
        <AgentAvatar name={agent.name} color={agent.color} className="size-10 text-[14px]" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-medium">{agent.name}</h3>
          <p className="line-clamp-2 text-[13px] text-pretty text-ink-2">{agent.role}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon-sm" variant="ghost" aria-label={`Actions for ${agent.name}`} className="-mr-1.5 -mt-1">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onEdit}>
              <Pencil /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={() => remove.mutate()}>
              <Trash2 /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="rounded-[10px] bg-hover px-3 py-2">
        <p className="line-clamp-3 font-mono text-[12px] leading-relaxed text-ink-2">{agent.instructions}</p>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {agent.useWebSearch && (
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-tint px-2 py-0.5 text-[11.5px] text-brand-ink">
            <Globe className="size-3" aria-hidden="true" /> Web research
          </span>
        )}
        {agent.capabilities.map((c) => (
          <span key={c} className="rounded-full px-2 py-0.5 text-[11.5px] text-ink-2 shadow-hairline">
            {c}
          </span>
        ))}
      </div>
    </li>
  );
}

export function AgentsView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const custom = useQuery({ queryKey: ["custom-agents"], queryFn: api.customAgents });
  const [editing, setEditing] = useState<CustomAgent | null>(null);
  const creating = params.get("new") === "1";

  const setCreating = (open: boolean) => {
    const next = new URLSearchParams(params);
    if (open) next.set("new", "1");
    else next.delete("new");
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  };

  const agents = custom.data?.agents ?? [];

  return (
    <div className="flex flex-col gap-10 pb-10">
      <PageHeader
        title="Agents"
        actions={
          <Button size="sm" onClick={() => setCreating(true)} className="border border-brand-line bg-brand text-white hover:bg-brand hover:brightness-110">
            <Plus /> New Agent
          </Button>
        }
      />

      <section aria-labelledby="custom-heading" className="flex flex-col gap-4">
        <div>
          <h2 id="custom-heading" className="heading-16">
            Your Agents
          </h2>
          <p className="text-sm text-ink-2">Give an agent a role and instructions. Select it in the composer and it takes its own subtask in every build.</p>
        </div>
        {custom.isError ? (
          <ErrorState title="Couldn’t load your agents" error={custom.error} onRetry={() => void custom.refetch()} />
        ) : custom.isPending ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-44 rounded-[14px]" />
            ))}
          </div>
        ) : agents.length === 0 ? (
          <EmptyState
            icon={Bot}
            title="No Custom Agents"
            description="Create a reviewer that enforces your conventions, a docs writer, or a test author, and add it to any build."
            action={
              <Button size="sm" variant="outline" onClick={() => setCreating(true)}>
                <Plus /> Create Agent
              </Button>
            }
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {agents.map((a, i) => (
              <CustomAgentCard key={a.id} agent={a} index={i} onEdit={() => setEditing(a)} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="builtin-heading" className="flex flex-col gap-4">
        <div>
          <h2 id="builtin-heading" className="heading-16">
            Built-in Team
          </h2>
          <p className="text-sm text-ink-2">The orchestrator picks from these automatically based on your prompt.</p>
        </div>
        <BuiltInAgents />
      </section>

      <AgentEditor
        open={creating || !!editing}
        agent={editing}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null);
            setCreating(false);
          }
        }}
      />
    </div>
  );
}
