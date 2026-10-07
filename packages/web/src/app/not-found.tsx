import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="font-mono text-sm text-muted-foreground">404</p>
      <h1 className="heading-24">Page Not Found</h1>
      <p className="max-w-sm text-sm text-muted-foreground">The page you’re looking for doesn’t exist or was moved.</p>
      <Button asChild variant="outline">
        <Link href="/">Back to Generate</Link>
      </Button>
    </main>
  );
}
