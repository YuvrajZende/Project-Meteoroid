import { AlertCircle, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { MobileMenuButton } from "@/components/mobile-menu-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumb?: { href: string; label: string };
}) {
  return (
    <>
      <div className="sticky top-0 z-20 -mx-4 flex h-14 shrink-0 items-center gap-3 bg-panel/90 px-4 backdrop-blur sm:-mx-6 sm:px-6">
        <MobileMenuButton />
        <h1 className="flex min-w-0 items-center gap-2 text-[17px] font-medium">
          {breadcrumb && (
            <>
              <Link href={breadcrumb.href} className="shrink-0 text-ink-3 transition-colors hover:text-ink">
                {breadcrumb.label}
              </Link>
              <span aria-hidden="true" className="text-ink-3">
                /
              </span>
            </>
          )}
          <span className="truncate">{title}</span>
        </h1>
        {actions && <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {description && <p className="-mt-1 pb-5 text-sm text-pretty text-ink-2">{description}</p>}
    </>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-16 text-center">
      <div className="grid size-10 place-items-center rounded-md shadow-border">
        <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <h2 className="heading-16">{title}</h2>
        <p className="mx-auto max-w-sm text-sm text-pretty text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function ErrorState({
  title = "Couldn’t load data",
  error,
  onRetry,
}: {
  title?: string;
  error: unknown;
  onRetry?: () => void;
}) {
  return (
    <Alert variant="destructive">
      <AlertCircle />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="flex flex-wrap items-center gap-3">
        <span>{error instanceof Error ? error.message : String(error)}</span>
        {onRetry && (
          <Button size="xs" variant="outline" onClick={onRetry}>
            Retry
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
