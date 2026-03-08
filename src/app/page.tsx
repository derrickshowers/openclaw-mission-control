import { api } from "@/lib/api";
import { DashboardContent } from "@/components/dashboard/dashboard-content";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let tasks: any[] = [];
  let agents: any[] = [];
  let status: any = null;
  let recentActivity: any[] = [];

  try {
    [tasks, agents, status, recentActivity] = await Promise.all([
      api.getTasks().catch(() => []),
      api.getAgents().catch(() => []),
      api.getStatus().catch(() => null),
      api.getActivity({ limit: "5" }).catch(() => []),
    ]);
  } catch {
    // API might not be running yet
  }

  return (
    <DashboardContent
      tasks={tasks}
      agents={agents}
      status={status}
      recentActivity={recentActivity}
    />
  );
}
