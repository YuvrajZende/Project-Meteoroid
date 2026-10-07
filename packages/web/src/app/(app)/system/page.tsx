import type { Metadata } from "next";
import { SystemView } from "./system-view";

export const metadata: Metadata = { title: "System" };

export default function SystemPage() {
  return <SystemView />;
}
