"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const LANG_BY_EXT: Record<string, string> = {
  ts: "typescript", tsx: "tsx", js: "javascript", mjs: "javascript", cjs: "javascript", jsx: "jsx",
  py: "python", go: "go", rs: "rust", java: "java", kt: "kotlin", rb: "ruby", php: "php", cs: "csharp",
  json: "json", yml: "yaml", yaml: "yaml", toml: "toml", md: "markdown", sql: "sql", prisma: "prisma",
  sh: "bash", env: "dotenv", html: "html", css: "css", graphql: "graphql", gql: "graphql", xml: "xml",
};

export function languageFor(path: string) {
  const name = path.split("/").pop()?.toLowerCase() ?? "";
  if (name === "dockerfile") return "docker";
  if (name.startsWith(".env")) return "dotenv";
  return LANG_BY_EXT[name.split(".").pop() ?? ""] ?? "text";
}

type Highlighter = Awaited<ReturnType<typeof import("shiki").createHighlighter>>;
let highlighterPromise: Promise<Highlighter> | null = null;

function getHighlighter() {
  highlighterPromise ??= import("shiki").then(({ createHighlighter }) =>
    createHighlighter({ themes: ["github-light", "github-dark-default"], langs: [] }),
  );
  return highlighterPromise;
}

async function highlight(code: string, lang: string) {
  const highlighter = await getHighlighter();
  if (lang !== "text" && !highlighter.getLoadedLanguages().includes(lang)) {
    await highlighter.loadLanguage(lang as Parameters<Highlighter["loadLanguage"]>[0]).catch(() => undefined);
  }
  const resolved = highlighter.getLoadedLanguages().includes(lang) ? lang : "text";
  return highlighter.codeToHtml(code, {
    lang: resolved,
    themes: { light: "github-light", dark: "github-dark-default" },
    defaultColor: false,
  });
}

const MAX_HIGHLIGHT = 200_000;

export function CodeView({ code, path }: { code: string; path: string }) {
  const [html, setHtml] = useState<{ key: string; value: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const key = `${path}:${code.length}`;

  useEffect(() => {
    if (code.length > MAX_HIGHLIGHT) return;
    let cancelled = false;
    highlight(code, languageFor(path))
      .then((value) => !cancelled && setHtml({ key, value }))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [code, path, key]);

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const lines = code.split("\n").length;

  return (
    <div className="relative min-w-0">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => void copy()}
            aria-label="Copy file contents"
            className="absolute top-2 right-2 z-10 bg-background/80"
          >
            {copied ? <Check /> : <Copy />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{copied ? "Copied" : "Copy"}</TooltipContent>
      </Tooltip>
      <div className="code-view overflow-auto font-mono text-[13px] leading-5" style={{ ["--lines" as string]: String(lines).length }}>
        {html?.key === key ? (
          <div dangerouslySetInnerHTML={{ __html: html.value }} />
        ) : (
          <pre className="shiki">
            <code>
              {code.split("\n").map((line, i) => (
                <span key={i} className="line">
                  {line}
                  {"\n"}
                </span>
              ))}
            </code>
          </pre>
        )}
      </div>
    </div>
  );
}
