import { DashboardContent } from "@/components/dashboard/dashboard-content";
import type { PersonalTask, Task } from "@/lib/api";
import { serverApi } from "@/lib/server-api";
import { normalizeTodayUsage, startOfLocalDay, toLocalDateKey, type TodayDashboardSnapshot } from "@/lib/today-dashboard";

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
  let personalTasks: PersonalTask[] = [];
  let initialTodaySnapshot: TodayDashboardSnapshot | null = null;

  try {
    const now = new Date();
    const today = toLocalDateKey(now);
    const start = startOfLocalDay(now).toISOString();
    const end = now.toISOString();

    const [
      assigned,
      blocked,
      done,
      fetchedPersonalTasks,
      fetchedNonNegotiables,
      fetchedBrainChannels,
      fetchedUsageRows,
    ] = await Promise.all([
      serverApi.getTasks({ assignee: "derrick" }).catch(() => []),
      serverApi.getTasks({ status: "blocked" }).catch(() => []),
      serverApi.getTasks({ status: "done" }).catch(() => []),
      serverApi.getPersonalTasks({ limit: 100, sort: "due" }).catch(() => []),
      serverApi.getTodayNonNegotiables({ date: today }).catch(() => []),
      serverApi.getBrainChannels().catch(() => []),
      serverApi.getUsageBreakdown({ start, end }).catch(() => []),
    ]);

    tasks = mergeUniqueTasks(assigned, blocked, done);
    personalTasks = fetchedPersonalTasks;
    initialTodaySnapshot = {
      dayKey: today,
      fetchedAt: new Date().toISOString(),
      nonNegotiables: fetchedNonNegotiables,
      brainChannels: fetchedBrainChannels,
      usageByProvider: normalizeTodayUsage(fetchedUsageRows),
    };
  } catch {
    // API may be unavailable during startup; render empty state.
  }

  return (
    <DashboardContent
      tasks={tasks}
      personalTasks={personalTasks}
      initialTodaySnapshot={initialTodaySnapshot}
    />
  );
}
