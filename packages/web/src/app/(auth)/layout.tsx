import Link from "next/link";
import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh flex-col overflow-y-auto bg-sidebar-bg">
      <header className="flex h-14 items-center px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2" aria-label="Meteoroid home">
          <Logo className="size-7" />
          <span className="text-sm font-semibold tracking-tight" translate="no">
            Meteoroid
          </span>
        </Link>
      </header>
      <main id="main" className="flex flex-1 items-start justify-center px-4 pt-[12vh] pb-16">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
