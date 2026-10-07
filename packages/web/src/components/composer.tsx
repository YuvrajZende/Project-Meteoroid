"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowUp, Blocks, Bot, Check, ChevronDown, Cloud, FlaskConical, Globe, Loader2, Plus, Sparkles, Undo2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { AgentAvatar } from "@/components/agent-avatar";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { api } from "@/lib/api";
import { useGeneration } from "@/lib/generation";
import { requestCompletionNotifications } from "@/lib/notify";
import { pluginSelection, usePluginSelection } from "@/lib/plugin-selection";
import { FOCUS_COMPOSER_EVENT, SET_PROMPT_EVENT } from "@/lib/sidebar";
import { cn } from "@/lib/utils";

const LANGUAGES: Record<string, { label: string; frameworks: string[] }> = {
  typescript: { label: "TypeScript", frameworks: ["fastify", "express", "nestjs", "hono"] },
  python: { label: "Python", frameworks: ["fastapi", "django", "flask"] },
  go: { label: "Go", frameworks: ["gin", "fiber", "echo"] },
  rust: { label: "Rust", frameworks: ["axum", "actix"] },
  java: { label: "Java", frameworks: ["spring-boot"] },
};

const EFFORT = [
  { value: 1, label: "Low", hint: "1 sub-agent" },
  { value: 3, label: "Medium", hint: "3 sub-agents" },
  { value: 5, label: "High", hint: "5 sub-agents" },
] as const;

const ENHANCE_SYSTEM_PROMPT =
  "You rewrite backend feature requests into precise build specs. Keep the user's intent. Name the resources, " +
  "their key fields and relations, the endpoints, auth model, validation and persistence. Plain prose, no markdown, " +
  "no preamble, under 120 words. Reply with the rewritten request only.";

const MIN_PROMPT = 10;
const MAX_PROMPT = 5000;

function EffortBars({ level }: { level: number }) {
  const filled = level >= 5 ? 4 : level >= 3 ? 3 : 1;
  return (
    <span aria-hidden="true" className="flex h-3 items-end gap-[2px]">
      {[1, 2, 3, 4].map((i) => (
        <span key={i} className={cn("w-[3px] rounded-[1px]", i <= filled ? "bg-ink-2" : "bg-line-strong")} style={{ height: `${3 + i * 2}px` }} />
      ))}
    </span>
  );
}

const chip =
  "inline-flex h-8 items-center gap-1.5 rounded-control px-2 text-[13.5px] text-ink-2 transition-colors hover:bg-hover-2 hover:text-ink data-[state=open]:bg-hover-2 data-[state=open]:text-ink";

export function Composer({ initialPrompt = "", autoFocus = true }: { initialPrompt?: string; autoFocus?: boolean }) {
  const router = useRouter();
  const { start } = useGeneration();
  const plugins = Object.values(usePluginSelection());
  const caps = useQuery({ queryKey: ["capabilities"], queryFn: api.capabilities, staleTime: 60_000 });
  const customAgents = useQuery({ queryKey: ["custom-agents"], queryFn: api.customAgents });
  const promptId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [prompt, setPrompt] = useState(initialPrompt);
  const [previousPrompt, setPreviousPrompt] = useState<string | null>(null);
  const [language, setLanguage] = useState("auto");
  const [framework, setFramework] = useState("auto");
  const [modeChoice, setMode] = useState<"live" | "demo" | null>(null);
  const [webSearch, setWebSearch] = useState(true);
  const [effort, setEffort] = useState(3);
  const [agentIds, setAgentIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [enhancing, setEnhancing] = useState(false);

  const webSearchAvailable = !!caps.data?.webSearch;
  const modelsReady = !!caps.data && caps.data.models.power.configured;
  // Default to demo when no builder model is configured, so the first run always works.
  const mode = modeChoice ?? (caps.data && !modelsReady ? "demo" : "live");
  const agents = customAgents.data?.agents ?? [];
  const busy = submitting || enhancing;

  useEffect(() => {
    const focus = () => textareaRef.current?.focus();
    const fill = (e: Event) => {
      setPrompt((e as CustomEvent<string>).detail);
      setPreviousPrompt(null);
      setError(null);
      textareaRef.current?.focus();
    };
    window.addEventListener(FOCUS_COMPOSER_EVENT, focus);
    window.addEventListener(SET_PROMPT_EVENT, fill);
    return () => {
      window.removeEventListener(FOCUS_COMPOSER_EVENT, focus);
      window.removeEventListener(SET_PROMPT_EVENT, fill);
    };
  }, []);

  const submit = async () => {
    const trimmed = prompt.trim();
    if (trimmed.length < MIN_PROMPT) {
      setError(`Describe the backend in at least ${MIN_PROMPT} characters.`);
      textareaRef.current?.focus();
      return;
    }
    setError(null);
    setSubmitting(true);
    void requestCompletionNotifications();
    const demo = mode === "demo";
    const projectId = await start({
      prompt: trimmed,
      config: {
        useAIThinking: true,
        useWebSearch: demo ? webSearch : webSearch && webSearchAvailable,
        maxSubtasks: Math.max(effort, agentIds.length + 1),
        demo,
      },
      agents: agentIds.length ? agentIds : undefined,
      pluginConfig: plugins.length ? plugins : undefined,
      context: {
        language: language === "auto" ? undefined : language,
        framework: framework === "auto" ? undefined : framework,
      },
    });
    router.push(`/projects/${projectId}`);
  };

  const enhance = async () => {
    const original = prompt.trim();
    if (original.length < MIN_PROMPT) {
      setError("Write a rough idea first, then enhance it.");
      textareaRef.current?.focus();
      return;
    }
    setError(null);
    setEnhancing(true);
    try {
      const res = await api.chat(original, { systemPrompt: ENHANCE_SYSTEM_PROMPT });
      const improved = res.response.trim().replace(/^["']|["']$/g, "").slice(0, MAX_PROMPT);
      setPreviousPrompt(original);
      for (let i = 0; i <= improved.length; i += 4) {
        setPrompt(improved.slice(0, i));
        await new Promise((r) => setTimeout(r, 8));
      }
      setPrompt(improved);
    } catch (e) {
      toast.error(e instanceof Error ? `Couldn’t enhance the prompt. ${e.message}` : "Couldn’t enhance the prompt.");
    } finally {
      setEnhancing(false);
      textareaRef.current?.focus();
    }
  };

  const effortMeta = EFFORT.find((e) => e.value === effort) ?? EFFORT[1];

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="w-full"
    >
      {/* Context strip */}
      <div className="mx-3 flex items-center gap-1 rounded-t-[12px] bg-composer-strip px-2 pt-1.5 pb-1 shadow-hairline">
        <DropdownMenu>
          <DropdownMenuTrigger className={chip}>
            <span className="grid size-4 place-items-center rounded-full bg-ink text-[9px] font-bold text-panel">
              {language === "auto" ? "*" : LANGUAGES[language].label[0]}
            </span>
            {language === "auto" ? "Any language" : LANGUAGES[language].label}
            <ChevronDown className="size-3.5 text-ink-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuRadioGroup
              value={language}
              onValueChange={(v) => {
                setLanguage(v);
                setFramework("auto");
              }}
            >
              <DropdownMenuRadioItem value="auto">Any language</DropdownMenuRadioItem>
              {Object.entries(LANGUAGES).map(([value, { label }]) => (
                <DropdownMenuRadioItem key={value} value={value}>
                  {label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {language !== "auto" && (
          <DropdownMenu>
            <DropdownMenuTrigger className={chip}>
              <span className="font-mono text-[12.5px]">{framework === "auto" ? "any framework" : framework}</span>
              <ChevronDown className="size-3.5 text-ink-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuRadioGroup value={framework} onValueChange={setFramework}>
                <DropdownMenuRadioItem value="auto">Any framework</DropdownMenuRadioItem>
                {LANGUAGES[language].frameworks.map((f) => (
                  <DropdownMenuRadioItem key={f} value={f} className="font-mono text-xs">
                    {f}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger className={cn(chip, "ml-auto")}>
            {mode === "demo" ? <FlaskConical className="size-3.5" /> : <Cloud className="size-3.5" />}
            {mode === "demo" ? "Demo" : "Live"}
            <ChevronDown className="size-3.5 text-ink-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuRadioGroup value={mode} onValueChange={(v) => setMode(v as "live" | "demo")}>
              <DropdownMenuRadioItem value="live" disabled={!modelsReady} className="items-start">
                <span>
                  <span className="block">Live</span>
                  <span className="block text-xs text-muted-foreground">
                    {modelsReady ? "Real models write your code." : "Add a builder model key to enable."}
                  </span>
                </span>
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="demo" className="items-start">
                <span>
                  <span className="block">Demo</span>
                  <span className="block text-xs text-muted-foreground">Simulated run, no API keys needed.</span>
                </span>
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Input */}
      <div
        className={cn(
          "rounded-[16px] bg-surface shadow-overlay transition-shadow focus-within:shadow-[0_0_0_1px_var(--line-strong),var(--shadow-lg-bui)]",
          busy && "shadow-[0_0_0_1px_var(--accent-line),var(--shadow-lg-bui)]",
        )}
      >
        <label htmlFor={promptId} className="sr-only">
          Describe the backend
        </label>
        <textarea
          id={promptId}
          ref={textareaRef}
          name="prompt"
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value);
            setPreviousPrompt(null);
            if (error) setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void submit();
            }
          }}
          autoFocus={autoFocus}
          rows={2}
          maxLength={MAX_PROMPT}
          readOnly={enhancing}
          placeholder="Describe it, ship it…"
          aria-invalid={!!error}
          aria-describedby={error ? `${promptId}-error` : undefined}
          className={cn(
            "block max-h-60 min-h-[64px] w-full resize-none bg-transparent px-5 pt-4 text-base outline-none [field-sizing:content] placeholder:text-ink-3 sm:text-[15px]",
            enhancing && "text-ink-2",
          )}
        />

        {(plugins.length > 0 || agentIds.length > 0) && (
          <div className="flex flex-wrap gap-1.5 px-4 pt-1">
            {agentIds.map((id) => {
              const a = agents.find((x) => x.id === id);
              if (!a) return null;
              return (
                <span key={id} className="inline-flex items-center gap-1.5 rounded-chip bg-hover py-0.5 pr-1 pl-1 text-[12px] text-ink-2" style={{ animation: "pop-in 200ms cubic-bezier(0.16,1,0.3,1) both" }}>
                  <AgentAvatar name={a.name} color={a.color} className="size-4 text-[9px]" />
                  {a.name}
                  <button type="button" aria-label={`Remove ${a.name}`} onClick={() => setAgentIds((ids) => ids.filter((x) => x !== id))} className="grid size-4 place-items-center rounded-full text-ink-3 hover:bg-hover-2 hover:text-ink">
                    <X className="size-3" />
                  </button>
                </span>
              );
            })}
            {plugins.map((p) => (
              <span key={p.pluginId} className="inline-flex items-center gap-1 rounded-chip bg-hover py-0.5 pr-1 pl-2 text-[12px] text-ink-2" style={{ animation: "pop-in 200ms cubic-bezier(0.16,1,0.3,1) both" }}>
                <Blocks className="size-3" aria-hidden="true" />
                {p.name}
                <button type="button" aria-label={`Detach ${p.name}`} onClick={() => pluginSelection.remove(p.pluginId!)} className="grid size-4 place-items-center rounded-full text-ink-3 hover:bg-hover-2 hover:text-ink">
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-0.5 px-2.5 pt-2 pb-2.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Link href="/plugins" className={cn(chip, "w-8 justify-center px-0")} aria-label="Plugins">
                <Blocks className="size-4" />
              </Link>
            </TooltipTrigger>
            <TooltipContent>{plugins.length ? `${plugins.length} plugin${plugins.length > 1 ? "s" : ""} attached` : "Attach plugins"}</TooltipContent>
          </Tooltip>

          <DropdownMenu>
            <DropdownMenuTrigger className={chip}>
              <Bot className="size-4" />
              <span className="hidden sm:inline">{agentIds.length ? `${agentIds.length} agent${agentIds.length > 1 ? "s" : ""}` : "Agents"}</span>
              <ChevronDown className="size-3.5 text-ink-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-72">
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Your agents join the built-in team</DropdownMenuLabel>
              {agents.length === 0 && <p className="px-2 py-1.5 text-sm text-muted-foreground">No custom agents yet.</p>}
              {agents.map((a) => (
                <DropdownMenuCheckboxItem
                  key={a.id}
                  checked={agentIds.includes(a.id)}
                  disabled={!agentIds.includes(a.id) && agentIds.length >= 4}
                  onSelect={(e) => e.preventDefault()}
                  onCheckedChange={(on) => setAgentIds((ids) => (on ? [...ids, a.id] : ids.filter((x) => x !== a.id)))}
                >
                  <AgentAvatar name={a.name} color={a.color} className="size-5 text-[10px]" />
                  <span className="min-w-0">
                    <span className="block truncate">{a.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{a.role}</span>
                  </span>
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/agents?new=1">
                  <Plus /> Create Agent
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger className={chip} aria-label={`Effort: ${effortMeta.label}`}>
              <EffortBars level={effort} />
              <span className="hidden sm:inline">{effortMeta.label}</span>
              <ChevronDown className="size-3.5 text-ink-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Effort</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={String(effort)} onValueChange={(v) => setEffort(Number(v))}>
                {EFFORT.map((e) => (
                  <DropdownMenuRadioItem key={e.value} value={String(e.value)}>
                    <EffortBars level={e.value} />
                    {e.label}
                    <span className="ml-auto pl-4 text-xs text-muted-foreground">{e.hint}</span>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                role="switch"
                aria-checked={webSearch}
                aria-label="Web research"
                onClick={() => setWebSearch((v) => !v)}
                className={cn(chip, "w-8 justify-center px-0", webSearch && "text-brand-ink")}
              >
                <Globe className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              Web research {webSearch ? "on" : "off"}
              {!webSearchAvailable && mode === "live" && " · needs TAVILY_API_KEY or BRAVE_SEARCH_API_KEY"}
            </TooltipContent>
          </Tooltip>

          {previousPrompt !== null && !enhancing && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="Undo enhancement"
                  onClick={() => {
                    setPrompt(previousPrompt);
                    setPreviousPrompt(null);
                  }}
                  className={cn(chip, "w-8 justify-center px-0")}
                >
                  <Undo2 className="size-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Restore your original prompt</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" onClick={() => void enhance()} disabled={busy} aria-label="Enhance prompt" className={cn(chip, "w-8 justify-center px-0 disabled:opacity-50")}>
                {enhancing ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              </button>
            </TooltipTrigger>
            <TooltipContent>{enhancing ? "Enhancing…" : "Enhance into a detailed spec"}</TooltipContent>
          </Tooltip>

          <span className="ml-auto hidden pr-2 text-[12px] text-ink-3 tabular sm:inline">
            {prompt.length > 0 && `${prompt.length}/${MAX_PROMPT}`}
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="submit"
                disabled={busy}
                aria-label="Start build"
                className="grid size-9 shrink-0 place-items-center rounded-[10px] border border-brand-line bg-brand text-white shadow-btn transition-[filter,opacity] hover:brightness-110 disabled:opacity-60"
              >
                {submitting ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
              </button>
            </TooltipTrigger>
            <TooltipContent>
              {mode === "demo" ? "Start demo build" : "Start build"} <kbd className="ml-1 font-mono text-[11px] opacity-70">Ctrl&nbsp;Enter</kbd>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
      {error && (
        <p id={`${promptId}-error`} role="alert" className="mt-2 px-4 text-sm text-destructive">
          {error}
        </p>
      )}
      {agentIds.length > 0 && (
        <p className="mt-2 flex items-center gap-1 px-4 text-xs text-ink-3">
          <Check className="size-3" /> Each selected agent gets its own subtask.
        </p>
      )}
    </form>
  );
}
