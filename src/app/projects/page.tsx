import { serverApi } from "@/lib/server-api";
import { ProjectsView } from "@/components/projects/projects-view";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const projects = await serverApi.getProjects().catch(() => []);

  return (
    <div className="h-full">
      <ProjectsView initialProjects={projects} />
    </div>
  );
}
