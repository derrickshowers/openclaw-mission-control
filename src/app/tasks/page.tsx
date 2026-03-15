import { KanbanBoard } from "@/components/tasks/kanban-board";
import { serverApi } from "@/lib/server-api";

export const dynamic = "force-dynamic";

interface TasksPageProps {
  searchParams?: Promise<{
    project_id?: string | string[];
  }>;
}

export default async function TasksPage({ searchParams }: TasksPageProps) {
  const resolvedSearchParams = (await searchParams) || {};
  const rawProjectId = resolvedSearchParams.project_id;
  const projectId = typeof rawProjectId === "string" && rawProjectId.trim() ? rawProjectId : undefined;

  const [teamTasks, projects] = await Promise.all([
    serverApi.getTasks(projectId ? { project_id: projectId } : undefined).catch(() => []),
    serverApi.getProjects().catch(() => []),
  ]);

  return (
    <div className="h-full">
      <KanbanBoard initialTasks={teamTasks} initialProjectId={projectId || null} projects={projects} />
    </div>
  );
}
