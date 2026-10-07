"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, Blocks, Bot, Layers, MessageSquare, Moon, Plus, Settings, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { api } from "@/lib/api";
import { FOCUS_COMPOSER_EVENT } from "@/lib/sidebar";

const PAGES = [
  { href: "/", label: "Builds", icon: Layers },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/plugins", label: "Plugins", icon: Blocks },
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/system", label: "System", icon: Activity },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function CommandMenu({ trigger }: { trigger: (open: () => void) => React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { setTheme } = useTheme();
  const outputs = useQuery({ queryKey: ["outputs"], queryFn: api.outputs, enabled: open });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <>
      {trigger(() => setOpen(true))}
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Type a command or search…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Actions">
            <CommandItem
              onSelect={() => {
                go("/");
                setTimeout(() => window.dispatchEvent(new Event(FOCUS_COMPOSER_EVENT)), 50);
              }}
            >
              <Plus /> New Build
            </CommandItem>
            <CommandItem onSelect={() => go("/agents?new=1")}>
              <Bot /> Create Agent
            </CommandItem>
          </CommandGroup>
          <CommandGroup heading="Go To">
            {PAGES.map(({ href, label, icon: Icon }) => (
              <CommandItem key={href} onSelect={() => go(href)}>
                <Icon /> {label}
              </CommandItem>
            ))}
          </CommandGroup>
          {!!outputs.data?.projects.length && (
            <CommandGroup heading="Builds">
              {outputs.data.projects.slice(0, 8).map((p) => (
                <CommandItem key={p.projectId} value={`${p.projectId} ${p.prompt ?? ""}`} onSelect={() => go(`/projects/${p.projectId}`)}>
                  <span className="truncate">{p.prompt ?? p.projectId}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          <CommandGroup heading="Theme">
            <CommandItem onSelect={() => setTheme("light")}>
              <Sun /> Light Theme
            </CommandItem>
            <CommandItem onSelect={() => setTheme("dark")}>
              <Moon /> Dark Theme
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
