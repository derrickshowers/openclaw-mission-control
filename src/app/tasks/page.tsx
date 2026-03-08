import { api } from "@/lib/api";
import { KanbanBoard } from "@/components/tasks/kanban-board";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  let tasks: any[] = [];

  try {
    tasks = await api.getTasks();
  } catch {
    // API might not be running
  }

  return (
    <div className="h-full">
      <KanbanBoard initialTasks={tasks} />
    </div>
  );
}
