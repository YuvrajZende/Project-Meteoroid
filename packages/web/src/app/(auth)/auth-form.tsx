"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const { login } = useAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isLogin = mode === "login";

  const onSubmit = async (form: FormData) => {
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const name = String(form.get("name") ?? "").trim();

    if (!email.includes("@")) return setError("Enter a valid email address.");
    if (password.length < 8) return setError("Passwords are at least 8 characters.");

    setError(null);
    setPending(true);
    try {
      if (isLogin) {
        await login(email, password);
        router.push("/");
      } else {
        await api.signup(email, password, name || undefined);
        toast.success("Account created. Check your inbox to confirm your email.");
        router.push("/login");
      }
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 401
          ? "Email or password is incorrect."
          : e instanceof Error
            ? e.message
            : "Something went wrong. Try again.",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-1 text-center">
        <h1 className="heading-24">{isLogin ? "Log in to Meteoroid" : "Create Your Account"}</h1>
        <p className="text-sm text-muted-foreground">
          {isLogin ? "Use the email you signed up with." : "Generate and keep your projects private."}
        </p>
      </div>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void onSubmit(new FormData(e.currentTarget));
        }}
        className="flex flex-col gap-4 rounded-xl bg-background p-6 shadow-menu"
      >
        {!isLogin && (
          <div className="space-y-1.5">
            <Label htmlFor="name">
              Name <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input id="name" name="name" autoComplete="name" placeholder="Ada Lovelace…" />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            spellCheck={false}
            autoFocus
            placeholder="you@example.com"
            aria-invalid={!!error}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={isLogin ? "current-password" : "new-password"}
            aria-invalid={!!error}
            aria-describedby={error ? "auth-error" : undefined}
          />
        </div>
        {error && (
          <p id="auth-error" role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" disabled={pending} className="w-full">
          {pending && <Loader2 className="animate-spin" />}
          {isLogin ? "Log In" : "Create Account"}
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        {isLogin ? "Don’t have an account? " : "Already have an account? "}
        <Link href={isLogin ? "/signup" : "/login"} className="text-foreground underline underline-offset-4">
          {isLogin ? "Sign up" : "Log in"}
        </Link>
      </p>
      <p className="text-center text-xs text-muted-foreground">
        <Link href="/" className="hover:text-foreground">
          Continue without an account
        </Link>
      </p>
    </div>
  );
}
