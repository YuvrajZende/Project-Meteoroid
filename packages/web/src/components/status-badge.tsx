import { cn } from "@/lib/utils";

export type Status = "running" | "ready" | "failed" | "cancelled" | "healthy" | "degraded" | "down" | "unknown";

const STYLES: Record<Status, { label: string; dot: string }> = {
  running: { label: "Building", dot: "bg-warning" },
  ready: { label: "Ready", dot: "bg-success" },
  failed: { label: "Failed", dot: "bg-destructive" },
  cancelled: { label: "Cancelled", dot: "bg-gray-700" },
  healthy: { label: "Healthy", dot: "bg-success" },
  degraded: { label: "Degraded", dot: "bg-warning" },
  down: { label: "Down", dot: "bg-destructive" },
  unknown: { label: "Unknown", dot: "bg-gray-700" },
};

export function StatusBadge({ status, label, className }: { status: Status; label?: string; className?: string }) {
  const style = STYLES[status];
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground", className)}>
      <span aria-hidden="true" className={cn("size-2 rounded-full", style.dot)} />
      {label ?? style.label}
    </span>
  );
}
