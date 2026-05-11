import { TeamView } from "@/components/team/team-view";
import { serverApi } from "@/lib/server-api";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const [agents, cronJobs] = await Promise.all([
    serverApi.getAgents().catch(() => []),
    serverApi.getCronJobs().catch(() => []),
  ]);

  return <TeamView agents={agents} initialCronJobs={cronJobs} />;
}
