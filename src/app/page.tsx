import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { serverApi } from "@/lib/server-api";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let tasks: any[] = [];
  let agents: any[] = [];
  let status: any = null;
  let recentActivity: any[] = [];
  let personalSummary: any = null;

  try {
    [tasks, agents, status, recentActivity, personalSummary] = await Promise.all([
      serverApi.getTasks().catch(() => []),
      serverApi.getAgents().catch(() => []),
      serverApi.getStatus().catch(() => null),
      serverApi.getActivity({ limit: "5" }).catch(() => []),
      serverApi.getPersonalTaskSummary().catch(() => null),
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
      personalSummary={personalSummary}
    />
  );
}
