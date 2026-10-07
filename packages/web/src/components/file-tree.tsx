"use client";

import { ChevronRight, File, Folder } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

interface TreeNode {
  name: string;
  path: string;
  children?: TreeNode[];
}

function buildTree(paths: string[]): TreeNode[] {
  const root: TreeNode = { name: "", path: "", children: [] };
  for (const path of paths) {
    let node = root;
    const parts = path.split("/");
    parts.forEach((part, i) => {
      const isFile = i === parts.length - 1;
      const childPath = parts.slice(0, i + 1).join("/");
      let child = node.children!.find((c) => c.name === part && !!c.children === !isFile);
      if (!child) {
        child = { name: part, path: childPath, children: isFile ? undefined : [] };
        node.children!.push(child);
      }
      node = child;
    });
  }
  const sort = (nodes: TreeNode[]): TreeNode[] =>
    nodes
      .sort((a, b) => (!!b.children === !!a.children ? a.name.localeCompare(b.name) : a.children ? -1 : 1))
      .map((n) => (n.children ? { ...n, children: sort(n.children) } : n));
  return sort(root.children!);
}

export function FileTree({
  paths,
  selected,
  onSelect,
  highlight,
}: {
  paths: string[];
  selected?: string;
  onSelect: (path: string) => void;
  highlight?: Set<string>;
}) {
  const tree = useMemo(() => buildTree(paths), [paths]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggle = (path: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  const render = (nodes: TreeNode[], depth: number): React.ReactNode =>
    nodes.map((node) => {
      const pad = { paddingLeft: `${depth * 12 + 8}px` };
      if (node.children) {
        const open = !collapsed.has(node.path);
        return (
          <li key={node.path} role="treeitem" aria-expanded={open} aria-selected={false}>
            <button
              type="button"
              onClick={() => toggle(node.path)}
              style={pad}
              className="flex h-7 w-full items-center gap-1.5 rounded-md pr-2 text-left text-[13px] text-muted-foreground hover:bg-gray-alpha-100 hover:text-foreground"
            >
              <ChevronRight className={cn("size-3.5 shrink-0 transition-transform", open && "rotate-90")} aria-hidden="true" />
              <Folder className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{node.name}</span>
            </button>
            {open && <ul role="group">{render(node.children, depth + 1)}</ul>}
          </li>
        );
      }
      const active = node.path === selected;
      return (
        <li key={node.path} role="treeitem" aria-selected={active}>
          <button
            type="button"
            onClick={() => onSelect(node.path)}
            style={{ paddingLeft: `${depth * 12 + 28}px` }}
            className={cn(
              "flex h-7 w-full items-center gap-1.5 rounded-md pr-2 text-left text-[13px] text-muted-foreground hover:bg-gray-alpha-100 hover:text-foreground",
              active && "bg-gray-alpha-200 text-foreground",
            )}
          >
            <File className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate font-mono text-xs" translate="no">
              {node.name}
            </span>
            {highlight?.has(node.path) && <span className="ml-auto size-1.5 shrink-0 rounded-full bg-info" aria-label="New" />}
          </button>
        </li>
      );
    });

  return (
    <ul role="tree" aria-label="Project files" className="flex flex-col gap-px p-1">
      {render(tree, 0)}
    </ul>
  );
}
