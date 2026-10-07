"use client";

import { useSyncExternalStore } from "react";
import type { PluginConfigItem } from "./types";

/**
 * Plugin configs attached to the next generation. Kept in memory only:
 * configs can hold credentials, so they never touch browser storage.
 */
let selection: Record<string, PluginConfigItem> = {};
const listeners = new Set<() => void>();
const EMPTY: Record<string, PluginConfigItem> = {};

function emit() {
  listeners.forEach((l) => l());
}

export const pluginSelection = {
  set(item: PluginConfigItem & { pluginId: string }) {
    selection = { ...selection, [item.pluginId]: item };
    emit();
  },
  remove(pluginId: string) {
    const rest = { ...selection };
    delete rest[pluginId];
    selection = rest;
    emit();
  },
  clear() {
    selection = {};
    emit();
  },
};

export function usePluginSelection() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => selection,
    () => EMPTY,
  );
}
