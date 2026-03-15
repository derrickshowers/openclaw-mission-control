import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { serverApi } from "@/lib/server-api";
import type { Task } from "@/lib/api";

export const dynamic = "force-dynamic";

function mergeUniqueTasks(...groups: Task[][]) {
  const map = new Map<string, Task>();
  for (const group of groups) {
    for (const task of group) map.set(task.id, task);
  }
  return Array.from(map.values());
}

export default async function DashboardPage() {
  let tasks: Task[] = [];
  let agents: any[] = [];
  let personalTasks: any[] = [];

  try {
    const [assigned, blocked, done, fetchedAgents, fetchedPersonalTasks] = await Promise.all([
      serverApi.getTasks({ assignee: "derrick" }).catch(() => []),
      serverApi.getTasks({ status: "blocked" }).catch(() => []),
      serverApi.getTasks({ status: "done" }).catch(() => []),
      serverApi.getAgents().catch(() => []),
      serverApi.getPersonalTasks({ limit: 100, sort: "due" }).catch(() => []),
    ]);

    tasks = mergeUniqueTasks(assigned, blocked, done);
    agents = fetchedAgents;
    personalTasks = fetchedPersonalTasks;
  } catch {
    // API may be unavailable during startup; render empty state.
  }

  return <DashboardContent tasks={tasks} agents={agents} personalTasks={personalTasks} />;
}
