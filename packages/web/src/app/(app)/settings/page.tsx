"use client";

import Link from "next/link";
import { PageHeader } from "@/components/states";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { API_URL } from "@/lib/api";
import { useAuth } from "@/lib/auth";

function Row({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-0.5">
        <h2 className="text-sm font-medium">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <div className="flex max-w-3xl flex-col gap-2">
      <title>Settings – Meteoroid</title>
      <PageHeader title="Settings" />
      <div className="divide-y">
        <Row title="Account" description={isAuthenticated ? `Signed in as ${user?.email ?? "unknown"}.` : "You’re using the API anonymously."}>
          {isAuthenticated ? (
            <Button variant="outline" onClick={() => void logout()}>
              Log Out
            </Button>
          ) : (
            <Button asChild>
              <Link href="/login">Log In</Link>
            </Button>
          )}
        </Row>
        <Row title="Theme" description="Follow the system, or pick light or dark.">
          <ThemeToggle />
        </Row>
        <Row title="API Endpoint" description="Set NEXT_PUBLIC_API_URL to point the app at another server.">
          <code className="rounded-md px-2 py-1 font-mono text-xs shadow-border" translate="no">
            {API_URL}
          </code>
        </Row>
      </div>
    </div>
  );
}
