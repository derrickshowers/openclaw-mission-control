import { TeamView } from "@/components/team/team-view";
import { serverApi } from "@/lib/server-api";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const agents = await serverApi.getAgents().catch(() => []);

  return <TeamView agents={agents} />;
}
