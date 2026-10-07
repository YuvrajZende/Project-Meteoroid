"use client";

import { useQuery } from "@tanstack/react-query";
import { Blocks, Check, Database, GitBranch, KeyRound, LineChart, Search, ShieldCheck, Sparkles } from "lucide-react";
import { useState } from "react";
import { EmptyState, ErrorState, PageHeader } from "@/components/states";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { usePluginSelection } from "@/lib/plugin-selection";
import type { PluginDefinition } from "@/lib/types";
import { cn } from "@/lib/utils";
import { PluginSheet } from "./plugin-sheet";

export const CATEGORY_META: Record<string, { label: string; icon: typeof Database; tint: string }> = {
  database: { label: "Databases", icon: Database, tint: "oklch(58% 0.17 255)" },
  security: { label: "Security", icon: ShieldCheck, tint: "oklch(56% 0.14 152)" },
  cicd: { label: "CI/CD", icon: GitBranch, tint: "oklch(55% 0.19 295)" },
  monitoring: { label: "Monitoring", icon: LineChart, tint: "oklch(66% 0.15 70)" },
};

export function PluginTile({ plugin, className }: { plugin: PluginDefinition; className?: string }) {
  const meta = CATEGORY_META[plugin.category];
  return (
    <span
      aria-hidden="true"
      className={cn("inline-grid shrink-0 place-items-center rounded-[28%] text-[15px] font-semibold text-white", className)}
      style={{ background: meta?.tint ?? "oklch(50% 0.01 264)" }}
    >
      {plugin.name.replace(/[^A-Za-z0-9]/g, "").slice(0, 2)}
    </span>
  );
}

const STEPS = [
  { icon: KeyRound, title: "Connect", text: "Add credentials. They stay in this tab and are never stored." },
  { icon: Blocks, title: "Attach", text: "Attached plugins ride along with your next build from the composer." },
  { icon: Sparkles, title: "Build", text: "Agents add the packages, env vars and setup code for each service." },
];

function HowItWorks() {
  return (
    <ol className="grid gap-px overflow-hidden rounded-[14px] bg-line shadow-hairline sm:grid-cols-3">
      {STEPS.map(({ icon: Icon, title, text }, i) => (
        <li key={title} className="flex gap-3 bg-surface p-4" style={{ animation: `fade-up 400ms cubic-bezier(0.23,1,0.32,1) ${i * 80}ms both` }}>
          <span className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-hover text-ink-2">
            <Icon className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[14px] font-medium">
              <span className="text-ink-3 tabular">{i + 1}</span> {title}
            </p>
            <p className="mt-0.5 text-[13px] text-pretty text-ink-2">{text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function PluginCatalog() {
  const catalog = useQuery({ queryKey: ["plugin-catalog"], queryFn: api.pluginCatalog, staleTime: 5 * 60_000 });
  const selection = usePluginSelection();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [open, setOpen] = useState<PluginDefinition | null>(null);

  const all = Object.values(catalog.data?.catalog ?? {}).flat();
  const attachedCount = Object.keys(selection).length;
  const needle = query.toLowerCase();
  const visible = all.filter(
    (p) =>
      (filter === "all" || (filter === "attached" ? !!selection[p.id] : p.category === filter)) &&
      (!needle || p.name.toLowerCase().includes(needle) || p.tags.some((t) => t.toLowerCase().includes(needle))),
  );

  const filters = [
    { key: "all", label: "All", count: all.length },
    { key: "attached", label: "Attached", count: attachedCount },
    ...Object.keys(catalog.data?.catalog ?? {}).map((c) => ({ key: c, label: CATEGORY_META[c]?.label ?? c, count: catalog.data!.catalog[c].length })),
  ];

  return (
    <div className="flex flex-col gap-6 pb-10">
      <PageHeader
        title="Plugins"
        actions={
          <div className="relative w-44 sm:w-64">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />
            <input
              type="search"
              aria-label="Search plugins"
              placeholder="Search plugins…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setQuery("")}
              spellCheck={false}
              className="h-9 w-full rounded-control bg-hover pr-3 pl-8 text-[14px] outline-none placeholder:text-ink-3 focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </div>
        }
      />

      <HowItWorks />

      <div role="tablist" aria-label="Filter plugins" className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1">
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            role="tab"
            aria-selected={filter === f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] text-ink-2 transition-colors hover:bg-hover hover:text-ink",
              filter === f.key && "bg-ink text-panel hover:bg-ink hover:text-panel",
            )}
          >
            {f.label}
            <span className={cn("tabular", filter === f.key ? "opacity-70" : "text-ink-3")}>{f.count}</span>
          </button>
        ))}
      </div>

      {catalog.isError ? (
        <ErrorState title="Couldn’t load plugins" error={catalog.error} onRetry={() => void catalog.refetch()} />
      ) : catalog.isPending ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
          {Array.from({ length: 9 }, (_, i) => (
            <Skeleton key={i} className="h-36 rounded-[14px]" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Blocks}
          title={filter === "attached" ? "Nothing Attached" : "No Plugins Found"}
          description={filter === "attached" ? "Attach a plugin and it joins your next build." : `Nothing matches “${query}”.`}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((plugin, i) => {
            const attached = !!selection[plugin.id];
            const meta = CATEGORY_META[plugin.category];
            return (
              <li key={plugin.id} style={{ animation: `fade-up 350ms cubic-bezier(0.23,1,0.32,1) ${Math.min(i, 12) * 25}ms both` }}>
                <button
                  type="button"
                  onClick={() => setOpen(plugin)}
                  className={cn(
                    "flex h-full w-full flex-col gap-3 rounded-[14px] bg-surface p-4 text-left shadow-card transition-shadow hover:shadow-raised",
                    attached && "shadow-[0_0_0_1.5px_var(--accent-line),var(--shadow-sm-bui)]",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <PluginTile plugin={plugin} className="size-10" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-medium">{plugin.name}</p>
                      <p className="text-[12.5px] text-ink-3">{meta?.label ?? plugin.category}</p>
                    </div>
                    {attached && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand-tint px-2 py-0.5 text-[11.5px] font-medium text-brand-ink" style={{ animation: "pop-in 200ms ease-out both" }}>
                        <Check className="size-3" aria-hidden="true" /> Attached
                      </span>
                    )}
                  </div>
                  <p className="line-clamp-2 text-[13px] text-pretty text-ink-2">{plugin.description}</p>
                  <div className="mt-auto flex items-center justify-between text-[12.5px]">
                    <span className="text-ink-3">{plugin.fields.length ? `${plugin.fields.length} setting${plugin.fields.length > 1 ? "s" : ""}` : "No setup needed"}</span>
                    <span className="font-medium text-ink-2">{attached ? "Manage" : "Connect"} →</span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <PluginSheet plugin={open} onOpenChange={(o) => !o && setOpen(null)} />
    </div>
  );
}
