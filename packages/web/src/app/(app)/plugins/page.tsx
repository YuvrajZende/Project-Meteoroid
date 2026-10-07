import type { Metadata } from "next";
import { PluginCatalog } from "./plugin-catalog";

export const metadata: Metadata = { title: "Plugins" };

export default function PluginsPage() {
  return <PluginCatalog />;
}
