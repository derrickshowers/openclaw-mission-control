import { KanbanBoard } from "@/components/tasks/kanban-board";
import { serverApi } from "@/lib/server-api";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const tasks = await serverApi.getTasks().catch(() => []);

  return (
    <div className="h-full">
      <KanbanBoard initialTasks={tasks} />
    </div>
  );
}
