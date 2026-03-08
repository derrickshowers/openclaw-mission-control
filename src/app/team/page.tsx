import { api } from "@/lib/api";
import { TeamView } from "@/components/team/team-view";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  let agents: any[] = [];

  try {
    agents = await api.getAgents();
  } catch {
    // API not available
  }

  return <TeamView agents={agents} />;
}
