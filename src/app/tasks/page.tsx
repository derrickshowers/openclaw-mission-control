import { TasksContainer } from "@/components/tasks/tasks-container";
import { serverApi } from "@/lib/server-api";

export const dynamic = "force-dynamic";

interface TasksPageProps {
  searchParams?: Promise<{ 
    project_id?: string | string[];
    scope?: string | string[];
  }>;
}

export default async function TasksPage({ searchParams }: TasksPageProps) {
  const resolvedSearchParams = (await searchParams) || {};
  
  const rawProjectId = resolvedSearchParams.project_id;
  const projectId = typeof rawProjectId === "string" && rawProjectId.trim() ? rawProjectId : undefined;
  
  const rawScope = resolvedSearchParams.scope;
  const scope = (typeof rawScope === "string" ? rawScope : "team") as "team" | "personal" | "all";

  // Fetch data based on scope
  const [teamTasks, personalTasks, projects] = await Promise.all([
    (scope === "team" || scope === "all") 
      ? serverApi.getTasks(projectId ? { project_id: projectId } : undefined).catch(() => [])
      : Promise.resolve([]),
    (scope === "personal" || scope === "all")
      ? serverApi.getPersonalTasks({ limit: 100 }).catch(() => [])
      : Promise.resolve([]),
    serverApi.getProjects().catch(() => []),
  ]);

  return (
    <div className="h-full">
      <TasksContainer 
        initialTeamTasks={teamTasks} 
        initialPersonalTasks={personalTasks}
        initialProjectId={projectId || null} 
        initialScope={scope}
        projects={projects}
      />
    </div>
  );
}
