"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { AppSidebar, SidebarContent } from "@/components/app-sidebar";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { SidebarProvider, useSidebar } from "@/lib/sidebar";

function MobileSidebar() {
  const { mobileOpen, setMobileOpen } = useSidebar();
  const pathname = usePathname();
  useEffect(() => setMobileOpen(false), [pathname, setMobileOpen]);
  return (
    <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
      <SheetContent side="left" className="w-[288px] border-0 bg-sidebar-bg p-0 [&>button]:hidden">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <SidebarContent onNavigate={() => setMobileOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex h-dvh bg-sidebar-bg">
        <AppSidebar />
        <MobileSidebar />
        <main
          id="main"
          className="relative m-0 flex min-w-0 flex-1 flex-col overflow-hidden bg-panel shadow-hairline md:my-2 md:mr-2 md:rounded-[14px]"
        >
          <div id="panel-scroll" className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 sm:px-6">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
