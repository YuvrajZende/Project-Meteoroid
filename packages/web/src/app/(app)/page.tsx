import type { Metadata } from "next";
import { Suspense } from "react";
import { BuildsView } from "./builds-view";

export const metadata: Metadata = { title: "Builds" };

export default function BuildsPage() {
  return (
    <Suspense>
      <BuildsView />
    </Suspense>
  );
}
