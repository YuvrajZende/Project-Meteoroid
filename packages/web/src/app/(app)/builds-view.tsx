"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Search } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { StatusIcon } from "@/components/app-sidebar";
import { Composer } from "@/components/composer";
import { Logo } from "@/components/logo";
import { ErrorState, PageHeader } from "@/components/states";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { useGeneration, type RunStatus } from "@/lib/generation";
import { SET_PROMPT_EVENT } from "@/lib/sidebar";
import { cn } from "@/lib/utils";

type Item = {
  id: string;
  title: string;
  status: RunStatus | "ready";
  time: number;
  stack: string | null;
};

const GROUPS: { key: string; label: string; dot: string; match: (s: Item["status"]) => boolean }[] = [
  { key: "building", label: "Building", dot: "bg-brand", match: (s) => s === "running" },
  { key: "ready", label: "Ready", dot: "bg-green", match: (s) => s === "ready" || s === "succeeded" },
  { key: "failed", label: "Needs attention", dot: "bg-red", match: (s) => s === "failed" || s === "cancelled" },
];

const noopSubscribe = () => () => {};

const shortDate = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });

const EXAMPLES = [
  "A todo API with JWT auth, Postgres and pagination",
  "A URL shortener with click analytics and rate limiting",
  "An e-commerce backend with carts, orders and Stripe checkout",
];

function Group({ label, dot, items }: { label: string; dot: string; items: Item[] }) {
  const [open, setOpen] = useState(true);
  return (
    <section className="flex flex-col gap-1">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="group flex h-8 items-center gap-2 px-1 text-[13px] text-ink-3 hover:text-ink-2"
      >
        <ChevronDown className={cn("size-3.5 transition-transform duration-200", !open && "-rotate-90")} aria-hidden="true" />
        <span className={cn("size-1.5 rounded-full", dot)} aria-hidden="true" />
        <span className="font-medium text-ink-2">{label}</span>
        <span className="tabular">{items.length}</span>
        <span aria-hidden="true" className="ml-2 h-px flex-1 bg-line" />
      </button>
      <div
        className="grid transition-[grid-template-rows,opacity] duration-300"
        style={{ gridTemplateRows: open ? "1fr" : "0fr", opacity: open ? 1 : 0, transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)" }}
      >
        <ul className="flex flex-col gap-0.5 overflow-hidden">
          {items.map((item, i) => (
            <li key={item.id} style={{ animation: `fade-up 300ms cubic-bezier(0.23,1,0.32,1) ${Math.min(i, 8) * 30}ms both` }}>
              <Link
                href={`/projects/${item.id}`}
                className="group/row flex h-12 items-center gap-3.5 rounded-[10px] px-3.5 transition-colors hover:bg-hover"
              >
                <StatusIcon status={item.status} className="size-[18px]" />
                <span className="min-w-0 flex-1 truncate text-[15px] text-ink">{item.title}</span>
                {item.stack && (
                  <span className="hidden shrink-0 rounded-full px-2 py-0.5 font-mono text-[11.5px] text-ink-3 shadow-hairline sm:inline" translate="no">
                    {item.stack}
                  </span>
                )}
                <span className="w-14 shrink-0 text-right text-[12.5px] text-ink-3 tabular">{shortDate.format(item.time)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function BuildsView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const query = params.get("q") ?? "";
  const { runs } = useGeneration();
  const outputs = useQuery({ queryKey: ["outputs"], queryFn: api.outputs });
  // This view hydrates inside a Suspense boundary, after the sidebar may already have the builds query
  // resolved; render the server's loading state until mounted so hydration matches.
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const loading = outputs.isPending || !mounted;

  const setQuery = (q: string) => {
    const next = new URLSearchParams(params);
    if (q) next.set("q", q);
    else next.delete("q");
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  };

  const items: Item[] = [
    ...Object.values(runs).map((r) => ({ id: r.projectId, title: r.prompt, status: r.status, time: r.startedAt, stack: null })),
    ...(outputs.data?.projects ?? [])
      .filter((p) => !runs[p.projectId])
      .map((p) => ({
        id: p.projectId,
        title: p.prompt ?? p.projectId,
        status: "ready" as const,
        time: new Date(p.updatedAt).getTime(),
        stack: [p.language, p.framework].filter(Boolean).join(" · ") || null,
      })),
  ].sort((a, b) => b.time - a.time);

  const needle = query.toLowerCase();
  const visible = needle ? items.filter((i) => i.title.toLowerCase().includes(needle) || i.id.includes(needle)) : items;
  const empty = !loading && items.length === 0;

  if (empty) {
    return (
      <>
        <PageHeader title="Builds" />
        <div className="flex flex-1 flex-col items-center justify-center pb-16">
          <div className="flex w-full max-w-2xl flex-col items-center gap-8">
            <div className="flex flex-col items-center gap-4 text-center" style={{ animation: "fade-up 500ms cubic-bezier(0.23,1,0.32,1) both" }}>
              <Logo className="size-11" />
              <div className="space-y-1.5">
                <h2 className="heading-24">What should we build?</h2>
                <p className="text-sm text-ink-2">Describe a backend. Agents plan it, research it and write it.</p>
              </div>
            </div>
            <div className="w-full" style={{ animation: "fade-up 500ms cubic-bezier(0.23,1,0.32,1) 80ms both" }}>
              <Composer />
            </div>
            <div className="flex flex-wrap justify-center gap-2" style={{ animation: "fade-in 500ms ease-out 200ms both" }}>
              {EXAMPLES.map((e) => (
                <ExampleChip key={e} text={e} />
              ))}
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Builds"
        actions={
          <div className="relative w-44 sm:w-72">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />
            <input
              type="search"
              aria-label="Search builds"
              placeholder="Search builds…"
              defaultValue={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setQuery("")}
              spellCheck={false}
              className="h-9 w-full rounded-control bg-hover pr-3 pl-8 text-[14px] outline-none placeholder:text-ink-3 focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </div>
        }
      />
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 pt-2 pb-8">
        {outputs.isError && <ErrorState title="Couldn’t load builds" error={outputs.error} onRetry={() => void outputs.refetch()} />}
        {loading ? (
          <div className="flex flex-col gap-2" aria-busy="true">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-12 rounded-[10px]" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <p className="py-12 text-center text-sm text-ink-3">No builds match “{query}”.</p>
        ) : (
          GROUPS.map((g) => {
            const groupItems = visible.filter((i) => g.match(i.status));
            return groupItems.length ? <Group key={g.key} label={g.label} dot={g.dot} items={groupItems} /> : null;
          })
        )}
      </div>
      <div className="sticky bottom-0 z-10 -mx-4 mt-auto px-4 pt-2 pb-4 sm:-mx-6 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <Composer autoFocus={false} />
        </div>
      </div>
    </>
  );
}

function ExampleChip({ text }: { text: string }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent(SET_PROMPT_EVENT, { detail: text }))}
      className="rounded-full px-3 py-1.5 text-[12.5px] text-ink-2 shadow-hairline transition-colors hover:bg-hover hover:text-ink"
    >
      {text}
    </button>
  );
}
