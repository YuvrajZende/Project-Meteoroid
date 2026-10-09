"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Copy, Download, FileCode2, Info, Loader2, MoreHorizontal, RotateCcw, Square, Terminal, Trash2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ActivityFeed } from "@/components/agent/activity-feed";
import { formatElapsed } from "@/components/agent/loading-state";
import { StatusIcon } from "@/components/app-sidebar";
import { ApiPlayground } from "@/components/api-playground";
import { CodeStream, useCodeStream } from "@/components/code-stream";
import { CodeView } from "@/components/code-view";
import { FileTree } from "@/components/file-tree";
import { EmptyState, ErrorState, PageHeader } from "@/components/states";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, api, downloadFile } from "@/lib/api";
import { formatBytes } from "@/lib/format";
import { useGeneration, useRun } from "@/lib/generation";
import type { OutputFile } from "@/lib/types";
import { cn } from "@/lib/utils";
import { BuildLog } from "./build-log";
import { RunDetails } from "./run-details";

function saveText(filename: string, content: string) {
  const href = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

type Pane = "activity" | "files" | "details";

function Segmented({
  value,
  onChange,
  items,
}: {
  value: Pane;
  onChange: (v: Pane) => void;
  items: { value: Pane; label: string; icon: typeof Info }[];
}) {
  return (
    <div role="tablist" aria-label="Build panels" className="flex w-fit items-center gap-0.5 rounded-[10px] bg-hover p-0.5">
      {items.map(({ value: v, label, icon: Icon }) => (
        <button
          key={v}
          type="button"
          role="tab"
          aria-selected={value === v}
          onClick={() => onChange(v)}
          className={cn(
            "inline-flex h-7 items-center gap-1.5 rounded-[8px] px-2.5 text-[13px] text-ink-2 transition-colors hover:text-ink",
            value === v && "bg-surface text-ink shadow-btn",
          )}
        >
          <Icon className="size-3.5" aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  );
}

function FilesPanel({
  running,
  liveFiles,
  files,
  isPending,
  error,
  onRetry,
  selectedPath,
  onSelect,
  liveView,
}: {
  running: boolean;
  liveView?: React.ReactNode;
  liveFiles: string[];
  files: OutputFile[];
  isPending: boolean;
  error: unknown;
  onRetry: () => void;
  selectedPath?: string;
  onSelect: (path: string) => void;
}) {
  const [filter, setFilter] = useState("");
  const paths = useMemo(() => (running ? liveFiles : files.map((f) => f.path)), [running, liveFiles, files]);
  const visible = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    return needle ? paths.filter((p) => p.toLowerCase().includes(needle)) : paths;
  }, [paths, filter]);
  const selected = files.find((f) => f.path === selectedPath);

  if (error && !running) {
    return (
      <div className="p-4">
        <ErrorState error={error} onRetry={onRetry} />
      </div>
    );
  }
  if (!paths.length && !isPending) {
    return (
      <div className="grid h-full place-items-center p-6">
        <EmptyState
          icon={FileCode2}
          title={running ? "Waiting for Files" : "No Files"}
          description={running ? "Files appear here as agents write them." : "This build didn’t produce any files."}
        />
      </div>
    );
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-1 grid-rows-[auto_minmax(0,1fr)] sm:grid-cols-[200px_minmax(0,1fr)] sm:grid-rows-1">
      <div className="flex max-h-56 min-h-0 flex-col border-b sm:max-h-none sm:border-r sm:border-b-0">
        <div className="border-b p-2">
          <input
            type="search"
            aria-label="Filter files"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setFilter("")}
            placeholder="Filter files…"
            spellCheck={false}
            className="h-7 w-full rounded-control bg-hover px-2 text-[12.5px] outline-none placeholder:text-ink-3 focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          {isPending && !running ? (
            <div className="space-y-2 p-3" aria-hidden="true">
              {Array.from({ length: 8 }, (_, i) => (
                <Skeleton key={i} className="h-5" style={{ width: `${50 + ((i * 17) % 40)}%` }} />
              ))}
            </div>
          ) : (
            <FileTree paths={visible} selected={selectedPath} onSelect={onSelect} highlight={running ? new Set(liveFiles.slice(-3)) : undefined} />
          )}
        </div>
      </div>
      <div className="flex min-h-0 min-w-0 flex-col">
        {running && liveView ? (
          liveView
        ) : selected ? (
          <>
            <div className="flex h-10 shrink-0 items-center justify-between gap-2 border-b px-3">
              <span className="truncate font-mono text-[12px]" translate="no">
                {selected.path}
              </span>
              <span className="flex shrink-0 items-center gap-1">
                <span className="pr-1 text-xs text-ink-3 tabular">{formatBytes(selected.size)}</span>
                {selected.content !== null && (
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    aria-label={`Download ${selected.path}`}
                    onClick={() => saveText(selected.path.split("/").pop() ?? "file.txt", selected.content ?? "")}
                  >
                    <Download />
                  </Button>
                )}
              </span>
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              {selected.content === null ? (
                <p className="p-4 text-sm text-ink-3">This file is too large to preview. Download the ZIP to view it.</p>
              ) : (
                <CodeView code={selected.content} path={selected.path} />
              )}
            </div>
          </>
        ) : (
          <p className="p-4 text-sm text-ink-3">{running ? "File contents load when the build finishes." : "Select a file to view it."}</p>
        )}
      </div>
    </div>
  );
}

export function ProjectView({ projectId }: { projectId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const run = useRun(projectId);
  const { start, cancel } = useGeneration();
  const runActive = run?.status === "running";
  const stream = useCodeStream(run?.files ?? [], run?.demo ? run.contents : undefined, !runActive);
  // Demo runs keep "typing" after the server finishes, until every streamed file has been shown.
  const typing = !!run?.demo && !!run.contents && !stream.drained;
  const running = runActive || typing;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [playgroundOpen, setPlaygroundOpen] = useState(false);

  const output = useQuery({
    queryKey: ["output", projectId],
    queryFn: () => api.output(projectId),
    enabled: !runActive,
    retry: (count, error) => !(error instanceof ApiError && error.status === 404) && count < 1,
  });

  const runStatus = run?.status;
  useEffect(() => {
    if (runStatus && runStatus !== "running") {
      void queryClient.invalidateQueries({ queryKey: ["output", projectId] });
      void queryClient.invalidateQueries({ queryKey: ["outputs"] });
    }
  }, [runStatus, projectId, queryClient]);

  useEffect(() => {
    if (runStatus === "succeeded" && !typing) toast.success("Build finished", { id: projectId });
    if (runStatus === "failed") toast.error("Build failed. See the activity log for details.", { id: projectId });
  }, [runStatus, typing, projectId]);

  const files = useMemo(() => output.data?.files ?? [], [output.data]);
  // Demo builds always produce the sample Todo API, which the playground simulates.
  const isDemo =
    !!run?.demo || files.some((f) => f.path === "README.md" && !!f.content?.includes("Meteoroid demo mode"));

  // Open the playground once, right after a demo build finishes in front of the user.
  const [autoOpened, setAutoOpened] = useState(false);
  if (run?.demo && runStatus === "succeeded" && !typing && !autoOpened && run.contents) {
    setAutoOpened(true);
    setPlaygroundOpen(true);
  }

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}?${next}`, { scroll: false });
  };

  const defaultFile = useMemo(
    () =>
      files.find((f) => /(^|\/)(index|main|app|server)\.[a-z]+$/.test(f.path) && f.path.split("/").length <= 2)?.path ??
      files.find((f) => f.path.toLowerCase() === "readme.md")?.path ??
      files[0]?.path,
    [files],
  );
  const selectedPath = params.get("file") ?? defaultFile;
  const fileCount = typing ? stream.visibleFiles.length : running ? (run?.files.length ?? 0) : files.length;

  // Desktop keeps activity on the left, so the right pane is files or details.
  const requested = params.get("tab") as Pane | null;
  const mobilePane: Pane = requested ?? (running || !output.data ? "activity" : "files");
  const rightPane: Pane = requested === "details" ? "details" : "files";

  const prompt = run?.prompt ?? output.data?.meta.prompt ?? null;
  const title = prompt ?? projectId;
  const status = running ? "running" : run?.status === "failed" ? "failed" : run?.status === "cancelled" ? "cancelled" : "ready";

  const remove = useMutation({
    mutationFn: () => api.deleteOutput(projectId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["outputs"] });
      toast.success("Build deleted");
      router.push("/");
    },
    onError: (error) => toast.error(error.message),
  });

  const download = async () => {
    setDownloading(true);
    try {
      await downloadFile(api.downloadUrl(projectId), `${projectId}.zip`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  };

  const regenerate = async () => {
    if (!prompt) return;
    const id = await start({ prompt, config: run?.demo ? { demo: true, useWebSearch: true } : undefined });
    router.push(`/projects/${id}`);
  };

  if (!run && output.error instanceof ApiError && output.error.status === 404) {
    return (
      <>
        <PageHeader title={projectId} breadcrumb={{ href: "/", label: "Builds" }} />
        <div className="grid flex-1 place-items-center">
          <EmptyState
            icon={FileCode2}
            title="Build Not Found"
            description={`No build named “${projectId}” exists, or you don’t have access to it.`}
            action={
              <Button asChild size="sm" variant="outline">
                <Link href="/">Back to Builds</Link>
              </Button>
            }
          />
        </div>
      </>
    );
  }

  const elapsed = run?.finishedAt ? run.finishedAt - run.startedAt : null;

  const activity = (
    <div className="flex flex-col gap-6 pb-8">
      {prompt && (
        <div className="self-end rounded-[14px] bg-hover px-4 py-3 text-[14.5px] leading-relaxed text-ink sm:max-w-[85%]" style={{ animation: "fade-up 300ms cubic-bezier(0.23,1,0.32,1) both" }}>
          {prompt}
        </div>
      )}
      {elapsed !== null && (
        <p className="flex items-center gap-1 text-[14px] text-ink-3">
          Worked for {formatElapsed(elapsed)} <ChevronRight className="size-3.5" aria-hidden="true" />
        </p>
      )}
      {run ? (
        <ActivityFeed run={run} />
      ) : (
        <p className="text-sm text-ink-3">This build’s live activity isn’t stored in this browser. Its files and details are on the right.</p>
      )}
      {run?.result?.isQuestion && run.result.answer && (
        <div className="max-w-[68ch] text-[14.5px] leading-relaxed whitespace-pre-wrap text-ink">{run.result.answer}</div>
      )}
      {run && <BuildLog run={run} compact />}
    </div>
  );

  const filesPanel = (
    <FilesPanel
      running={running}
      liveFiles={typing ? stream.visibleFiles : (run?.files ?? [])}
      liveView={run?.demo && run.contents ? <CodeStream path={stream.path} code={stream.typed} /> : undefined}
      files={files}
      isPending={output.isPending}
      error={output.error}
      onRetry={() => void output.refetch()}
      selectedPath={selectedPath}
      onSelect={(p) => setParam("file", p)}
    />
  );

  return (
    <>
      <PageHeader
        title={<span title={title}>{title}</span>}
        breadcrumb={{ href: "/", label: "Builds" }}
        actions={
          <>
            <StatusIcon status={status} className="size-[18px]" />
            <div className="hidden lg:block">
              <Segmented
                value={rightPane}
                onChange={(v) => setParam("tab", v)}
                items={[
                  { value: "files", label: fileCount ? `Files ${fileCount}` : "Files", icon: FileCode2 },
                  { value: "details", label: "Details", icon: Info },
                ]}
              />
            </div>
            {isDemo && !running && (
              <Button size="sm" onClick={() => setPlaygroundOpen(true)}>
                <Terminal /> Try API
              </Button>
            )}
            {running ? (
              <Button variant="outline" size="sm" onClick={() => cancel(projectId)}>
                <Square /> Stop
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => void download()} disabled={!files.length || downloading} className="hidden sm:inline-flex">
                {downloading ? <Loader2 className="animate-spin" /> : <Download />} ZIP
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon-sm" variant="ghost" aria-label="More actions">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => void download()} disabled={!files.length}>
                  <Download /> Download ZIP
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void regenerate()} disabled={!prompt || running}>
                  <RotateCcw /> Regenerate
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    void navigator.clipboard.writeText(projectId);
                    toast.success("Build ID copied");
                  }}
                >
                  <Copy /> Copy Build ID
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" disabled={!output.data || running} onSelect={() => setConfirmDelete(true)}>
                  <Trash2 /> Delete Build…
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      {/* Below desktop: one pane at a time */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:hidden">
        <Segmented
          value={mobilePane}
          onChange={(v) => setParam("tab", v)}
          items={[
            { value: "activity", label: "Activity", icon: ChevronRight },
            { value: "files", label: fileCount ? `Files ${fileCount}` : "Files", icon: FileCode2 },
            { value: "details", label: "Details", icon: Info },
          ]}
        />
        {mobilePane === "activity" && activity}
        {mobilePane === "files" && <div className="mb-4 h-[70vh] overflow-hidden rounded-[14px] bg-surface shadow-card">{filesPanel}</div>}
        {mobilePane === "details" && <RunDetails run={run} meta={output.data?.meta} />}
      </div>

      {/* Desktop: activity left, files or details right */}
      <div className="hidden min-h-0 flex-1 gap-5 pb-4 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="no-scrollbar min-h-0 overflow-y-auto pr-1">
          <div className="mx-auto max-w-2xl pt-2">{activity}</div>
        </div>
        <div className="min-h-0 overflow-hidden rounded-[14px] bg-surface shadow-card">
          {rightPane === "files" ? (
            filesPanel
          ) : (
            <div className="h-full overflow-y-auto p-5">
              <RunDetails run={run} meta={output.data?.meta} />
            </div>
          )}
        </div>
      </div>

      {isDemo && <ApiPlayground open={playgroundOpen} onOpenChange={setPlaygroundOpen} />}

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Build</DialogTitle>
            <DialogDescription>
              This permanently removes <span className="font-mono text-foreground">{projectId}</span> and all of its generated files.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" onClick={() => remove.mutate()} disabled={remove.isPending}>
              {remove.isPending && <Loader2 className="animate-spin" />} Delete Build
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
