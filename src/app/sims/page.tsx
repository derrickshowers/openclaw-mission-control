import { SimsPage } from "@/components/sims/sims-page";
import type { Task } from "@/lib/api";
import { serverApi } from "@/lib/server-api";

export const dynamic = "force-dynamic";

export default async function SimsRoutePage() {
  let agents: unknown[] = [];
  let blockedTasks: Task[] = [];
  let activeTasks: Task[] = [];

  try {
    [agents, blockedTasks, activeTasks] = await Promise.all([
      serverApi.getAgents().catch(() => []),
      serverApi.getTasks({ status: "blocked" }).catch(() => []),
      serverApi.getTasks({ status: "in_progress" }).catch(() => []),
    ]);
  } catch {
    // Render empty room if the API is unavailable during boot.
  }

  return (
    <SimsPage
      initialAgents={agents}
      initialBlockedTasks={blockedTasks}
      initialActiveTasks={activeTasks}
    />
  );
}
