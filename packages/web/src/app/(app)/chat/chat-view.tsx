"use client";

import { ArrowUp, MessageSquare, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Orb } from "@/components/aicss/Orb";
import { StreamingText } from "@/components/aicss/StreamingText";
import { ThinkingState } from "@/components/aicss/ThinkingState";
import { EmptyState, PageHeader } from "@/components/states";
import { Button } from "@/components/ui/button";
import { ApiError, api } from "@/lib/api";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant" | "error";
  content: string;
  meta?: string;
}

const SUGGESTIONS = [
  "When should I use Postgres over MongoDB for a SaaS backend?",
  "How do I structure refresh token rotation?",
  "Compare Fastify and Hono for an edge API",
];

export function ChatView() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, pending]);

  const send = async (text = input) => {
    const content = text.trim();
    if (!content || pending) return;
    const controller = new AbortController();
    setPending(controller);
    setInput("");
    setMessages((m) => [...m, { id: crypto.randomUUID(), role: "user", content }]);
    try {
      const res = await api.chat(content, { signal: controller.signal });
      setMessages((m) => [
        ...m,
        { id: crypto.randomUUID(), role: "assistant", content: res.response, meta: `${res.model} · ${formatDuration(res.duration)}` },
      ]);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setMessages((m) => [
          ...m,
          {
            id: crypto.randomUUID(),
            role: "error",
            content: error instanceof ApiError ? error.message : "Something went wrong. Try again.",
          },
        ]);
      }
    } finally {
      setPending(null);
      inputRef.current?.focus();
    }
  };

  return (
    <>
      <PageHeader title="Chat" />
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6">

      <div className="flex min-h-[40vh] flex-col gap-6" aria-live="polite">
        {!messages.length ? (
          <EmptyState
            icon={MessageSquare}
            title="Start a Conversation"
            description="Answers come from the configured power model. Nothing is generated or written to disk."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void send(s)}
                    className="rounded-full px-3 py-1 text-xs text-muted-foreground shadow-border transition-colors hover:bg-gray-alpha-100 hover:text-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            }
          />
        ) : (
          messages.map((m, index) => (
            <div key={m.id} className={cn("flex flex-col gap-1", m.role === "user" && "items-end")}>
              <div
                className={cn(
                  "max-w-[85%] rounded-lg px-4 py-2.5 text-sm leading-6 whitespace-pre-wrap",
                  m.role === "user" && "bg-primary text-primary-foreground",
                  m.role === "assistant" && "shadow-border",
                  m.role === "error" && "text-destructive shadow-border",
                )}
              >
                {m.role === "assistant" && index === messages.length - 1 ? <StreamingText text={m.content} /> : m.content}
              </div>
              {m.meta && <span className="font-mono text-[11px] text-muted-foreground">{m.meta}</span>}
            </div>
          ))
        )}
        {pending && (
          <div className="flex items-center gap-2" role="status">
            <Orb variant="S1" size={18} />
            <ThinkingState />
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className="sticky bottom-0 mt-auto mb-4 rounded-[16px] bg-surface shadow-overlay"
      >
        <label htmlFor="chat-input" className="sr-only">
          Message
        </label>
        <textarea
          id="chat-input"
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          rows={2}
          maxLength={5000}
          placeholder="Ask anything about backend development…"
          className="block w-full resize-none bg-transparent px-4 pt-3 text-base outline-none placeholder:text-muted-foreground sm:text-sm"
        />
        <div className="flex items-center justify-between px-3 pb-3">
          <span className="text-xs text-muted-foreground">Enter to send · Shift&nbsp;+&nbsp;Enter for a new line</span>
          {pending ? (
            <Button type="button" size="icon-sm" variant="outline" className="rounded-full" aria-label="Stop" onClick={() => pending.abort()}>
              <Square />
            </Button>
          ) : (
            <Button type="submit" size="icon-sm" className="rounded-[10px] border border-brand-line bg-brand text-white hover:bg-brand hover:brightness-110" aria-label="Send">
              <ArrowUp />
            </Button>
          )}
        </div>
      </form>
      </div>
    </>
  );
}
