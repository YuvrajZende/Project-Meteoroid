import type { Metadata } from "next";
import { Suspense } from "react";
import { ProjectView } from "./project-view";

export async function generateMetadata({ params }: PageProps<"/projects/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: id };
}

export default async function ProjectPage({ params }: PageProps<"/projects/[id]">) {
  const { id } = await params;
  return (
    <Suspense>
      <ProjectView projectId={decodeURIComponent(id)} />
    </Suspense>
  );
}
