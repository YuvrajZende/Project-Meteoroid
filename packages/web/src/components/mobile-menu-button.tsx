"use client";

import { Menu } from "lucide-react";
import { useSidebar } from "@/lib/sidebar";

export function MobileMenuButton() {
  const { setMobileOpen } = useSidebar();
  return (
    <button
      type="button"
      onClick={() => setMobileOpen(true)}
      aria-label="Open navigation"
      className="-ml-1.5 grid size-8 shrink-0 place-items-center rounded-control text-ink-2 hover:bg-hover md:hidden"
    >
      <Menu className="size-4" />
    </button>
  );
}
