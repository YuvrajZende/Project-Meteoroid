"use client";

import { Check, Loader2, Play, RotateCcw, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type Method = "GET" | "POST" | "PATCH" | "DELETE";

interface UseCase {
  id: string;
  title: string;
  description: string;
  method: Method;
  path: string;
  body?: unknown;
  auth: boolean;
}

const BASE_URL = "http://localhost:3000";
const TODO_ID = "{{todoId}}";

// The use cases the demo build's Todo API was generated for, in the order a user would hit them.
const USE_CASES: UseCase[] = [
  { id: "health", title: "Health check", description: "Server is up and the database answers.", method: "GET", path: "/health", auth: false },
  {
    id: "register",
    title: "Sign up",
    description: "Create an account. The password is hashed with scrypt before it’s stored.",
    method: "POST",
    path: "/auth/register",
    body: { email: "ada@example.com", password: "correct-horse-battery" },
    auth: false,
  },
  {
    id: "login",
    title: "Log in",
    description: "Exchange credentials for a JWT that expires in 15 minutes.",
    method: "POST",
    path: "/auth/login",
    body: { email: "ada@example.com", password: "correct-horse-battery" },
    auth: false,
  },
  { id: "unauthorized", title: "Blocked without a token", description: "Todo routes reject requests that carry no bearer token.", method: "GET", path: "/todos", auth: false },
  { id: "create", title: "Create a todo", description: "Adds a todo owned by the logged-in user.", method: "POST", path: "/todos", body: { title: "Ship the Meteoroid demo" }, auth: true },
  { id: "create-2", title: "Create another", description: "A second todo, so the list has something to page through.", method: "POST", path: "/todos", body: { title: "Write the launch notes" }, auth: true },
  { id: "list", title: "List todos", description: "Paginated, newest first, scoped to the current user.", method: "GET", path: "/todos?page=1&limit=20", auth: true },
  { id: "complete", title: "Mark a todo done", description: "Partial update of the most recently created todo.", method: "PATCH", path: `/todos/${TODO_ID}`, body: { done: true }, auth: true },
  { id: "invalid", title: "Validation error", description: "Empty titles are rejected before touching the database.", method: "POST", path: "/todos", body: { title: "" }, auth: true },
  { id: "delete", title: "Delete a todo", description: "Removes the todo. Other users’ todos can’t be touched.", method: "DELETE", path: `/todos/${TODO_ID}`, auth: true },
];

interface Todo {
  id: string;
  user_id: string;
  title: string;
  done: boolean;
  created_at: string;
}

interface MockResponse {
  status: number;
  body?: unknown;
}

const publicTodo = ({ id, title, done, created_at }: Todo) => ({ id, title, done, created_at });
const uuid = () => crypto.randomUUID();
const b64url = (value: unknown) => btoa(JSON.stringify(value)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
const badRequest = (message: string): MockResponse => ({ status: 400, body: { statusCode: 400, error: "Bad Request", message } });

/** In-memory stand-in for the generated Fastify app, following the same routes and rules. */
class MockTodoApi {
  private users = new Map<string, { id: string; email: string; password: string }>();
  private todos: Todo[] = [];
  private tokens = new Map<string, string>();
  private startedAt = Date.now();

  handle(method: Method, rawPath: string, body: unknown, token: string | null): MockResponse {
    const url = new URL(rawPath, BASE_URL);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const input = (body ?? {}) as Record<string, unknown>;

    if (method === "GET" && path === "/health") {
      return { status: 200, body: { status: "ok", uptime: Number(((Date.now() - this.startedAt) / 1000 + 42).toFixed(3)) } };
    }

    if (method === "POST" && (path === "/auth/register" || path === "/auth/login")) {
      const email = typeof input.email === "string" ? input.email.toLowerCase() : "";
      const password = typeof input.password === "string" ? input.password : "";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return badRequest("body/email must be a valid email");
      if (password.length < 8) return badRequest("body/password must be at least 8 characters");

      if (path === "/auth/register") {
        if (this.users.has(email)) return { status: 409, body: { error: "Email already registered" } };
        const user = { id: uuid(), email, password };
        this.users.set(email, user);
        return { status: 201, body: { id: user.id, email } };
      }
      const user = this.users.get(email);
      if (!user || user.password !== password) return { status: 401, body: { error: "Invalid credentials" } };
      const iat = Math.floor(Date.now() / 1000);
      const accessToken = [b64url({ alg: "HS256", typ: "JWT" }), b64url({ sub: user.id, iat, exp: iat + 900 }), b64url(uuid()).slice(0, 43)].join(".");
      this.tokens.set(accessToken, user.id);
      return { status: 200, body: { accessToken } };
    }

    if (path === "/todos" || path.startsWith("/todos/")) {
      const userId = token ? this.tokens.get(token) : undefined;
      if (!userId) return { status: 401, body: { error: "Unauthorized" } };
      const id = path.split("/")[2];
      const mine = this.todos.filter((t) => t.user_id === userId);

      if (!id && method === "GET") {
        const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
        const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 20) || 20));
        const items = [...mine].reverse().slice((page - 1) * limit, page * limit).map(publicTodo);
        return { status: 200, body: { page, limit, items } };
      }
      if (!id && method === "POST") {
        const title = typeof input.title === "string" ? input.title : "";
        if (title.length < 1 || title.length > 200) return badRequest("body/title must be between 1 and 200 characters");
        const todo: Todo = { id: uuid(), user_id: userId, title, done: false, created_at: new Date().toISOString() };
        this.todos.push(todo);
        return { status: 201, body: publicTodo(todo) };
      }
      const todo = mine.find((t) => t.id === id);
      if (id && method === "PATCH") {
        if (!todo) return { status: 404, body: { error: "Not found" } };
        if (typeof input.title === "string") todo.title = input.title;
        if (typeof input.done === "boolean") todo.done = input.done;
        return { status: 200, body: { id: todo.id, title: todo.title, done: todo.done } };
      }
      if (id && method === "DELETE") {
        if (!todo) return { status: 404, body: { error: "Not found" } };
        this.todos = this.todos.filter((t) => t !== todo);
        return { status: 204 };
      }
    }

    return { status: 404, body: { message: `Route ${method}:${path} not found`, error: "Not Found", statusCode: 404 } };
  }
}

const STATUS_TEXT: Record<number, string> = {
  200: "OK", 201: "Created", 204: "No Content", 400: "Bad Request", 401: "Unauthorized", 404: "Not Found", 409: "Conflict",
};

interface Exchange {
  method: Method;
  url: string;
  status: number;
  body?: unknown;
  ms: number;
}

interface LogLine {
  time: string;
  text: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function ApiPlayground({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const serverRef = useRef(new MockTodoApi());
  const tokenRef = useRef<string | null>(null);
  const todoIdRef = useRef<string | null>(null);
  const runningAllRef = useRef(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  const [selected, setSelected] = useState(USE_CASES[0].id);
  const [method, setMethod] = useState<Method>(USE_CASES[0].method);
  const [path, setPath] = useState(USE_CASES[0].path);
  const [bodyText, setBodyText] = useState("");
  const [useAuth, setUseAuth] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [runningAll, setRunningAll] = useState(false);
  const [response, setResponse] = useState<Exchange | null>(null);
  const [results, setResults] = useState<Record<string, number>>({});
  const [log, setLog] = useState<LogLine[]>(bootLog);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ block: "nearest" });
  }, [log]);

  const select = (useCase: UseCase) => {
    setSelected(useCase.id);
    setMethod(useCase.method);
    setPath(useCase.path.replace(TODO_ID, todoIdRef.current ?? ":id"));
    setBodyText(useCase.body === undefined ? "" : JSON.stringify(useCase.body, null, 2));
    setUseAuth(useCase.auth);
  };

  const send = async (req: { id: string; method: Method; path: string; bodyText: string; auth: boolean }) => {
    let body: unknown;
    if (req.bodyText.trim()) {
      try {
        body = JSON.parse(req.bodyText);
      } catch {
        setResponse({ method: req.method, url: req.path, status: 400, body: { statusCode: 400, error: "Bad Request", message: "Body is not valid JSON" }, ms: 1 });
        return;
      }
    }
    setSending(true);
    setResponse(null);
    const ms = 40 + Math.round(Math.random() * 160);
    await sleep(ms + 250);
    const res = serverRef.current.handle(req.method, req.path, body, req.auth ? tokenRef.current : null);
    const resBody = res.body as Record<string, unknown> | undefined;
    if (req.path === "/auth/login" && res.status === 200 && typeof resBody?.accessToken === "string") {
      tokenRef.current = resBody.accessToken;
      setToken(resBody.accessToken);
    }
    if (req.method === "POST" && req.path === "/todos" && res.status === 201 && typeof resBody?.id === "string") {
      todoIdRef.current = resBody.id;
    }
    setResponse({ method: req.method, url: req.path, status: res.status, body: res.body, ms });
    setResults((r) => ({ ...r, [req.id]: res.status }));
    setLog((l) => [
      ...l.slice(-40),
      { time: now(), text: `${req.method} ${req.path} → ${res.status} ${STATUS_TEXT[res.status] ?? ""} (${ms}ms)` },
    ]);
    setSending(false);
  };

  const runAll = async () => {
    runningAllRef.current = true;
    setRunningAll(true);
    for (const useCase of USE_CASES) {
      if (!runningAllRef.current) break;
      select(useCase);
      await sleep(500);
      if (!runningAllRef.current) break;
      await send({
        id: useCase.id,
        method: useCase.method,
        path: useCase.path.replace(TODO_ID, todoIdRef.current ?? ":id"),
        bodyText: useCase.body === undefined ? "" : JSON.stringify(useCase.body),
        auth: useCase.auth,
      });
      await sleep(1100);
    }
    runningAllRef.current = false;
    setRunningAll(false);
  };

  const reset = () => {
    runningAllRef.current = false;
    serverRef.current = new MockTodoApi();
    tokenRef.current = null;
    todoIdRef.current = null;
    setToken(null);
    setResponse(null);
    setResults({});
    setLog(bootLog());
    select(USE_CASES[0]);
  };

  const current = USE_CASES.find((u) => u.id === selected);
  const hasBody = method === "POST" || method === "PATCH";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) runningAllRef.current = false;
        onOpenChange(next);
      }}
    >
      <DialogContent className="flex h-[min(86vh,760px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <div className="flex flex-wrap items-center gap-3 border-b px-5 py-4 pr-12">
          <div className="min-w-0">
            <DialogTitle className="text-base">API Playground</DialogTitle>
            <DialogDescription className="mt-1 flex items-center gap-2 text-xs">
              <span className="relative inline-flex size-2">
                <span className="absolute inset-0 rounded-full bg-green" style={{ animation: "records-pulse 1.6s ease-in-out infinite" }} />
              </span>
              Todo API running at <span className="font-mono text-foreground">{BASE_URL}</span>
            </DialogDescription>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={reset} disabled={sending}>
              <RotateCcw /> Reset Data
            </Button>
            {runningAll ? (
              <Button size="sm" variant="outline" onClick={() => (runningAllRef.current = false)}>
                <X /> Stop
              </Button>
            ) : (
              <Button size="sm" onClick={() => void runAll()} disabled={sending}>
                <Play /> Run All Use Cases
              </Button>
            )}
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 sm:grid-cols-[260px_minmax(0,1fr)]">
          <nav aria-label="Use cases" className="max-h-48 min-h-0 overflow-y-auto border-b p-2 sm:max-h-none sm:border-r sm:border-b-0">
            {USE_CASES.map((u, i) => {
              const status = results[u.id];
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => select(u)}
                  disabled={runningAll}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-control px-2 py-1.5 text-left text-[13px] transition-colors hover:bg-hover disabled:cursor-default",
                    selected === u.id && "bg-hover-2 hover:bg-hover-2",
                  )}
                >
                  <span className="w-4 shrink-0 text-right text-[11px] text-ink-3 tabular">{i + 1}</span>
                  <span className="w-12 shrink-0 font-mono text-[10.5px] font-semibold text-ink-2">{u.method}</span>
                  <span className="min-w-0 flex-1 truncate">{u.title}</span>
                  {status !== undefined && (
                    <span className={cn("font-mono text-[11px] tabular", status < 400 ? "text-green" : "text-ink-3")}>{status}</span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="flex min-h-0 flex-col">
            <div className="space-y-3 border-b p-4">
              {current && <p className="text-[13px] text-ink-2">{current.description}</p>}
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void send({ id: selected, method, path, bodyText, auth: useAuth });
                }}
              >
                <div className="flex min-w-0 flex-1 items-center rounded-control bg-hover font-mono text-[12.5px]">
                  <span className="shrink-0 px-2.5 font-semibold">{method}</span>
                  <span className="hidden shrink-0 text-ink-3 sm:inline">{BASE_URL}</span>
                  <input
                    aria-label="Request path"
                    value={path}
                    onChange={(e) => setPath(e.target.value)}
                    spellCheck={false}
                    className="h-9 min-w-0 flex-1 bg-transparent pr-2 outline-none"
                  />
                </div>
                <Button type="submit" size="sm" className="h-9" disabled={sending || runningAll}>
                  {sending ? <Loader2 className="animate-spin" /> : <Send />} Send
                </Button>
              </form>
              <label className="flex items-center gap-2 text-[12.5px] text-ink-2">
                <Switch checked={useAuth} onCheckedChange={setUseAuth} />
                Authorization: Bearer
                <span className="truncate font-mono text-[11.5px] text-ink-3">{token ? `${token.slice(0, 28)}…` : "log in to get a token"}</span>
              </label>
              {hasBody && (
                <textarea
                  aria-label="Request body"
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  spellCheck={false}
                  rows={Math.min(6, Math.max(2, bodyText.split("\n").length))}
                  className="block w-full resize-none rounded-control bg-hover px-3 py-2 font-mono text-[12.5px] outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                />
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-4" aria-live="polite">
              {sending ? (
                <p className="flex items-center gap-2 text-sm text-ink-3">
                  <Loader2 className="size-3.5 animate-spin" /> Waiting for response…
                </p>
              ) : response ? (
                <div style={{ animation: "fade-up 250ms cubic-bezier(0.23,1,0.32,1) both" }}>
                  <div className="mb-2 flex items-center gap-3 text-[12.5px]">
                    <span className={cn("inline-flex items-center gap-1 font-mono font-semibold", response.status < 400 ? "text-green" : "text-destructive")}>
                      {response.status < 400 ? <Check className="size-3.5" /> : <X className="size-3.5" />}
                      {response.status} {STATUS_TEXT[response.status]}
                    </span>
                    <span className="text-ink-3 tabular">{response.ms} ms</span>
                    <span className="text-ink-3">application/json</span>
                  </div>
                  <pre className="overflow-auto rounded-control bg-hover p-3 font-mono text-[12.5px] leading-5">
                    {response.body === undefined ? "(empty body)" : JSON.stringify(response.body, null, 2)}
                  </pre>
                </div>
              ) : (
                <p className="text-sm text-ink-3">Pick a use case and press Send, or run them all in order.</p>
              )}
            </div>

            <div className="h-28 shrink-0 overflow-y-auto border-t bg-hover/60 px-4 py-2 font-mono text-[11.5px] leading-[18px] text-ink-2">
              {log.map((line, i) => (
                <div key={i} className="truncate" style={{ animation: "fade-in 200ms both" }}>
                  <span className="text-ink-3">{line.time}</span> {line.text}
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function bootLog(): LogLine[] {
  return [
    { time: now(), text: "Server listening at http://0.0.0.0:3000" },
    { time: now(), text: "Connected to postgres (pool max 10)" },
  ];
}

function now() {
  return new Date().toLocaleTimeString([], { hour12: false });
}
