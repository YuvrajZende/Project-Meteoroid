import type { AgentColor } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Solid swatches per agent color; light text on all of them. */
const COLORS: Record<AgentColor, string> = {
  ember: "oklch(58% 0.19 32)",
  blue: "oklch(58% 0.17 255)",
  green: "oklch(56% 0.14 152)",
  amber: "oklch(66% 0.15 70)",
  violet: "oklch(55% 0.19 295)",
  pink: "oklch(60% 0.19 350)",
  teal: "oklch(58% 0.11 190)",
  gray: "oklch(50% 0.01 264)",
};

export function agentColorValue(color: AgentColor) {
  return COLORS[color] ?? COLORS.gray;
}

export function AgentAvatar({ name, color, className }: { name: string; color: AgentColor; className?: string }) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      aria-hidden="true"
      className={cn("inline-grid shrink-0 place-items-center rounded-[30%] font-semibold text-white", className)}
      style={{ background: agentColorValue(color) }}
    >
      {initials}
    </span>
  );
}
