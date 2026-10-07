"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import { GenerationProvider } from "@/lib/generation";
import { RunWatcher } from "@/components/run-watcher";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: false },
        },
      }),
  );

  return (
    <ThemeProvider attribute={["class", "data-theme"]} defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <GenerationProvider>
            <TooltipProvider delayDuration={300}>
              {children}
              <RunWatcher />
              <Toaster position="bottom-right" />
            </TooltipProvider>
          </GenerationProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
