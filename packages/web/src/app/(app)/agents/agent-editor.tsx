"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AgentAvatar, agentColorValue } from "@/components/agent-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { AGENT_COLORS, type AgentColor, type CustomAgent, type CustomAgentInput } from "@/lib/types";
import { cn } from "@/lib/utils";

const TEMPLATES: { label: string; agent: CustomAgentInput }[] = [
  {
    label: "Code Reviewer",
    agent: {
      name: "Code Reviewer",
      role: "a strict reviewer who hardens the generated code",
      instructions:
        "Review the code other agents produce. Add input validation with zod on every route, consistent error responses ({ error, message }), and remove any hard-coded secrets. Write the result as a REVIEW.md listing what you changed and why.",
      capabilities: ["review", "security"],
      useWebSearch: false,
      color: "violet",
    },
  },
  {
    label: "Test Writer",
    agent: {
      name: "Test Writer",
      role: "an engineer who writes fast, focused integration tests",
      instructions:
        "Write integration tests with vitest for every route: happy path, validation errors, auth failures and not-found cases. Put them under tests/ and add an npm test script.",
      capabilities: ["testing"],
      useWebSearch: false,
      color: "green",
    },
  },
  {
    label: "Docs Writer",
    agent: {
      name: "Docs Writer",
      role: "a technical writer who documents the API",
      instructions:
        "Produce an OpenAPI 3.1 spec (openapi.yaml) and a README section with a curl example for each endpoint. Use realistic example payloads.",
      capabilities: ["docs", "openapi"],
      useWebSearch: true,
      color: "blue",
    },
  },
];

const EMPTY: CustomAgentInput = { name: "", role: "", instructions: "", capabilities: [], useWebSearch: false, color: "ember" };

function Form({ agent, onDone }: { agent: CustomAgent | null; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<CustomAgentInput>(
    agent
      ? { name: agent.name, role: agent.role, instructions: agent.instructions, capabilities: agent.capabilities, useWebSearch: agent.useWebSearch, color: agent.color }
      : EMPTY,
  );
  const [capabilities, setCapabilities] = useState(form.capabilities.join(", "));
  const [errors, setErrors] = useState<Partial<Record<keyof CustomAgentInput, string>>>({});

  const save = useMutation({
    mutationFn: (input: CustomAgentInput) => (agent ? api.updateCustomAgent(agent.id, input) : api.createCustomAgent(input)),
    onSuccess: ({ agent: saved }) => {
      void queryClient.invalidateQueries({ queryKey: ["custom-agents"] });
      toast.success(agent ? `${saved.name} updated` : `${saved.name} created`);
      onDone();
    },
    onError: (e) => toast.error(e.message),
  });

  const set = <K extends keyof CustomAgentInput>(key: K, value: CustomAgentInput[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const submit = () => {
    const input: CustomAgentInput = {
      ...form,
      name: form.name.trim(),
      role: form.role.trim(),
      instructions: form.instructions.trim(),
      capabilities: capabilities
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean)
        .slice(0, 8),
    };
    const next: typeof errors = {};
    if (input.name.length < 2) next.name = "Use at least 2 characters.";
    if (input.role.length < 3) next.role = "Describe the role in a few words.";
    if (input.instructions.length < 10) next.instructions = "Write at least one clear instruction.";
    setErrors(next);
    if (Object.keys(next).length) {
      document.getElementById(`agent-${Object.keys(next)[0]}`)?.focus();
      return;
    }
    save.mutate(input);
  };

  return (
    <form
      noValidate
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <SheetHeader>
        <SheetTitle>{agent ? "Edit Agent" : "New Agent"}</SheetTitle>
        <SheetDescription>Agents get their own subtask and follow these instructions when writing code.</SheetDescription>
      </SheetHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 pb-4">
        {!agent && (
          <div className="flex flex-wrap gap-1.5">
            <span className="w-full text-xs text-ink-3">Start from a template</span>
            {TEMPLATES.map((t) => (
              <button
                key={t.label}
                type="button"
                onClick={() => {
                  setForm(t.agent);
                  setCapabilities(t.agent.capabilities.join(", "));
                  setErrors({});
                }}
                className="rounded-full px-2.5 py-1 text-[12.5px] text-ink-2 shadow-hairline transition-colors hover:bg-hover hover:text-ink"
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3 rounded-[12px] bg-hover p-3">
          <AgentAvatar name={form.name || "?"} color={form.color} className="size-11 text-[15px]" />
          <div className="min-w-0">
            <p className="truncate text-[14px] font-medium">{form.name || "Untitled agent"}</p>
            <p className="truncate text-[12.5px] text-ink-3">{form.role || "Role appears here"}</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="agent-name">Name</Label>
          <Input id="agent-name" value={form.name} maxLength={40} onChange={(e) => set("name", e.target.value)} placeholder="Code Reviewer…" aria-invalid={!!errors.name} autoComplete="off" />
          {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="agent-role">Role</Label>
          <Input id="agent-role" value={form.role} maxLength={140} onChange={(e) => set("role", e.target.value)} placeholder="a strict reviewer who hardens the code…" aria-invalid={!!errors.role} autoComplete="off" />
          {errors.role ? <p className="text-xs text-destructive">{errors.role}</p> : <p className="text-xs text-ink-3">Completes “You are &lt;name&gt;, …”.</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="agent-instructions">Instructions</Label>
          <Textarea
            id="agent-instructions"
            value={form.instructions}
            maxLength={4000}
            rows={7}
            onChange={(e) => set("instructions", e.target.value)}
            placeholder="What should this agent produce, and which rules must it follow?…"
            aria-invalid={!!errors.instructions}
            className="font-mono text-[13px]"
          />
          <div className="flex justify-between text-xs">
            <span className="text-destructive">{errors.instructions}</span>
            <span className="text-ink-3 tabular">{form.instructions.length}/4000</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="agent-capabilities">Capabilities</Label>
          <Input id="agent-capabilities" value={capabilities} onChange={(e) => setCapabilities(e.target.value)} placeholder="review, security…" autoComplete="off" spellCheck={false} />
          <p className="text-xs text-ink-3">Comma-separated tags, up to 8.</p>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Color</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup">
            {AGENT_COLORS.map((c: AgentColor) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={form.color === c}
                aria-label={c}
                onClick={() => set("color", c)}
                className={cn("size-7 rounded-full ring-offset-2 ring-offset-surface transition-shadow", form.color === c && "ring-2 ring-ink")}
                style={{ background: agentColorValue(c) }}
              />
            ))}
          </div>
        </fieldset>

        <label className="flex cursor-pointer items-start justify-between gap-4 rounded-[12px] p-3 shadow-hairline">
          <span className="space-y-0.5">
            <span className="block text-sm font-medium">Web Research</span>
            <span className="block text-xs text-ink-3">Let this agent use the web search tool before writing.</span>
          </span>
          <Switch checked={form.useWebSearch} onCheckedChange={(v) => set("useWebSearch", v)} aria-label="Web research" />
        </label>
      </div>

      <SheetFooter className="flex-row justify-end gap-2 border-t">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending && <Loader2 className="animate-spin" />}
          {agent ? "Save Agent" : "Create Agent"}
        </Button>
      </SheetFooter>
    </form>
  );
}

export function AgentEditor({ open, agent, onOpenChange }: { open: boolean; agent: CustomAgent | null; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-lg">
        {open && <Form key={agent?.id ?? "new"} agent={agent} onDone={() => onOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  );
}
