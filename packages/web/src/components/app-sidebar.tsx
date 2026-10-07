"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  Blocks,
  Bot,
  CircleCheck,
  CircleX,
  Layers,
  LogIn,
  LogOut,
  MessageSquare,
  PanelLeft,
  Plus,
  Search,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CommandMenu } from "@/components/command-menu";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useGeneration, type RunStatus } from "@/lib/generation";
import { FOCUS_COMPOSER_EVENT, useSidebar } from "@/lib/sidebar";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Builds", icon: Layers },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/plugins", label: "Plugins", icon: Blocks },
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/system", label: "System", icon: Activity },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/" || pathname.startsWith("/projects");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function StatusIcon({ status, className }: { status: RunStatus | "ready"; className?: string }) {
  if (status === "running") {
    return (
      <span className={cn("relative grid size-4 shrink-0 place-items-center", className)} aria-label="Building">
        <span className="absolute inset-0 rounded-full border-[1.5px] border-line-strong border-t-brand" style={{ animation: "spin 800ms linear infinite" }} />
      </span>
    );
  }
  if (status === "failed") return <CircleX className={cn("size-4 shrink-0 fill-red text-panel", className)} aria-label="Failed" />;
  if (status === "cancelled") return <CircleX className={cn("size-4 shrink-0 fill-ink-3 text-panel", className)} aria-label="Stopped" />;
  return <CircleCheck className={cn("size-4 shrink-0 fill-green text-panel", className)} aria-label="Ready" />;
}

const shortDate = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });

function NavItem({ href, label, icon: Icon, collapsed, onNavigate }: (typeof NAV)[number] & { collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const active = isActive(pathname, href);
  const link = (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-9 items-center gap-2.5 rounded-control px-2.5 text-[14px] text-ink-2 transition-colors hover:bg-hover hover:text-ink",
        active && "bg-hover-2 font-medium text-ink",
        collapsed && "justify-center px-0",
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      {collapsed ? <span className="sr-only">{label}</span> : label}
    </Link>
  );
  if (!collapsed) return link;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

function RecentBuilds({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { runs } = useGeneration();
  const outputs = useQuery({ queryKey: ["outputs"], queryFn: api.outputs });

  const items = [
    ...Object.values(runs).map((r) => ({
      id: r.projectId,
      title: r.prompt,
      status: r.status as RunStatus | "ready",
      time: r.startedAt,
    })),
    ...(outputs.data?.projects ?? [])
      .filter((p) => !runs[p.projectId])
      .map((p) => ({ id: p.projectId, title: p.prompt ?? p.projectId, status: "ready" as const, time: new Date(p.updatedAt).getTime() })),
  ]
    .sort((a, b) => b.time - a.time)
    .slice(0, 8);

  if (!items.length) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1">
      <span className="px-2.5 pt-1 pb-1 text-[12px] text-ink-3">Recent</span>
      <ul className="no-scrollbar -mx-1 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-1">
        {items.map((item) => {
          const href = `/projects/${item.id}`;
          const active = pathname === href;
          return (
            <li key={item.id}>
              <Link
                href={href}
                onClick={onNavigate}
                className={cn(
                  "flex items-start gap-2.5 rounded-control px-2.5 py-2 transition-colors hover:bg-hover",
                  active && "bg-hover-2",
                )}
              >
                <StatusIcon status={item.status} className="mt-0.5" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] text-ink">{item.title}</span>
                  <span className="mt-0.5 flex items-center justify-between gap-2 text-[11.5px] text-ink-3">
                    <span className="truncate font-mono" translate="no">
                      {item.id}
                    </span>
                    <span className="shrink-0">{shortDate.format(item.time)}</span>
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function StatusCard({ collapsed }: { collapsed: boolean }) {
  const { stream } = useGeneration();
  const caps = useQuery({ queryKey: ["capabilities"], queryFn: api.capabilities, staleTime: 60_000 });
  const ready = caps.data
    ? [caps.data.models.fast.configured, caps.data.models.power.configured, !!caps.data.webSearch].filter(Boolean).length
    : 0;
  const online = stream === "open";

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Link href="/system" className="mx-auto grid size-9 place-items-center rounded-control hover:bg-hover" aria-label="System status">
            <span className={cn("size-2 rounded-full", online ? "bg-green" : stream === "connecting" ? "bg-orange" : "bg-red")} />
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right">{online ? "API live" : "API offline"}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Link href="/system" className="block rounded-card bg-panel px-3 py-2.5 shadow-hairline transition-colors hover:bg-hover">
      <div className="flex items-baseline justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
          <span className={cn("size-1.5 rounded-full", online ? "bg-green" : stream === "connecting" ? "bg-orange" : "bg-red")} />
          {online ? "API live" : stream === "connecting" ? "Connecting…" : "API offline"}
        </span>
        <span className="text-[12px] text-ink-3 tabular">{ready}/3 ready</span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-hover-2" aria-hidden="true">
        <div className="h-full rounded-full bg-ink-2 transition-[width] duration-500" style={{ width: `${(ready / 3) * 100}%` }} />
      </div>
    </Link>
  );
}

function UserRow({ collapsed }: { collapsed: boolean }) {
  const { user, isAuthenticated, logout } = useAuth();
  const name = user?.name || user?.email || "Guest";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex w-full items-center gap-2.5 rounded-control px-1.5 py-1.5 text-left transition-colors hover:bg-hover",
            collapsed && "justify-center",
          )}
          aria-label="Account menu"
        >
          <Avatar className="size-7">
            <AvatarFallback className="bg-hover-2 text-[11px] font-medium">{name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          {!collapsed && <span className="min-w-0 flex-1 truncate text-[14px] text-ink">{name}</span>}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <div className="truncate text-sm font-medium">{name}</div>
          {user?.email && <div className="truncate text-xs text-muted-foreground">{user.email}</div>}
        </DropdownMenuLabel>
        <div className="px-2 py-1.5">
          <ThemeToggle />
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings /> Settings
          </Link>
        </DropdownMenuItem>
        {isAuthenticated ? (
          <DropdownMenuItem onSelect={() => void logout()}>
            <LogOut /> Log Out
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem asChild>
            <Link href="/login">
              <LogIn /> Log In
            </Link>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SidebarContent({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const router = useRouter();
  const { toggleCollapsed } = useSidebar();

  const newBuild = () => {
    onNavigate?.();
    router.push("/");
    // Let the page mount before focusing.
    setTimeout(() => window.dispatchEvent(new Event(FOCUS_COMPOSER_EVENT)), 50);
  };

  return (
    <div className="flex h-full flex-col gap-3 px-3 py-3">
      <div className={cn("flex items-center gap-2.5 px-1", collapsed && "flex-col")}>
        <Link href="/" onClick={onNavigate} className="flex min-w-0 flex-1 items-center gap-2.5" aria-label="Meteoroid home">
          <Logo className="size-8" />
          {!collapsed && (
            <span className="min-w-0">
              <span className="block truncate text-[15px] leading-tight font-semibold" translate="no">
                Meteoroid
              </span>
              <span className="block truncate text-[12px] leading-tight text-ink-3">Backend builder</span>
            </span>
          )}
        </Link>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="hidden size-8 shrink-0 place-items-center rounded-control text-ink-3 transition-colors hover:bg-hover hover:text-ink md:grid"
            >
              <PanelLeft className="size-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {collapsed ? "Expand" : "Collapse"} sidebar <kbd className="ml-1 font-mono text-[11px] opacity-70">Ctrl&nbsp;B</kbd>
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="h-px bg-line" />

      <CommandMenu
        trigger={(open) =>
          collapsed ? (
            <button type="button" onClick={open} aria-label="Search" className="mx-auto grid size-9 place-items-center rounded-control text-ink-2 hover:bg-hover">
              <Search className="size-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={open}
              className="flex h-9 w-full items-center gap-2 rounded-control bg-panel px-2.5 text-[14px] text-ink-3 shadow-hairline transition-colors hover:text-ink-2"
            >
              <Search className="size-4" aria-hidden="true" />
              Search
              <kbd className="ml-auto font-mono text-[11px]">Ctrl&nbsp;K</kbd>
            </button>
          )
        }
      />

      <button
        type="button"
        onClick={newBuild}
        className={cn(
          "flex h-9 items-center gap-2 rounded-control border border-brand-line bg-brand px-2.5 text-[14px] font-medium text-white shadow-btn transition-[filter] hover:brightness-110",
          collapsed && "mx-auto w-9 justify-center px-0",
        )}
        aria-label="New build"
      >
        <Plus className="size-4" aria-hidden="true" />
        {!collapsed && "New Build"}
      </button>

      <nav aria-label="Main" className="flex flex-col gap-0.5">
        {NAV.map((item) => (
          <NavItem key={item.href} {...item} collapsed={collapsed} onNavigate={onNavigate} />
        ))}
      </nav>

      <div className="h-px bg-line" />

      {collapsed ? <div className="flex-1" /> : <RecentBuilds onNavigate={onNavigate} />}

      <div className="flex flex-col gap-2">
        <StatusCard collapsed={collapsed} />
        <UserRow collapsed={collapsed} />
      </div>
    </div>
  );
}

export function AppSidebar() {
  const { collapsed } = useSidebar();
  return (
    <aside
      aria-label="Sidebar"
      className={cn(
        "hidden h-dvh shrink-0 flex-col transition-[width] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] md:flex",
        collapsed ? "w-[68px]" : "w-[272px]",
      )}
    >
      <SidebarContent collapsed={collapsed} />
    </aside>
  );
}
