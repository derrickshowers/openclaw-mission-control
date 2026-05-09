import { parseUTC } from "@/lib/dates";
import { normalizeAgentId, resolveAgentAvatarUrl, TEAM_AGENT_IDS } from "@/lib/agents";
import type { Task } from "@/lib/api";
import type { SimsAgentSceneState, SimsAgentSnapshot, SimsRoomState, SimsZoneId, SimsZoneSummary } from "./sims-types";

const AGENT_META: Record<string, { role: string }> = {
  frank: { role: "Orchestrator" },
  tom: { role: "Lead Architect" },
  michael: { role: "Full Stack Engineer" },
  joanna: { role: "UX/Product Designer" },
  ivy: { role: "Venture Researcher" },
};

const DESK_LAYOUT: Record<string, {
  zoneId: SimsZoneId;
  zoneLabel: string;
  accent: string;
  deskPosition: [number, number, number];
  avatarPosition: [number, number, number];
}> = {
  frank: {
    zoneId: "frank-desk",
    zoneLabel: "Frank Desk",
    accent: "#60a5fa",
    deskPosition: [-4.2, 0.4, -0.8],
    avatarPosition: [-4.2, 0.78, -0.1],
  },
  michael: {
    zoneId: "michael-desk",
    zoneLabel: "Michael Desk",
    accent: "#f59e0b",
    deskPosition: [-3.1, 0.4, 2.4],
    avatarPosition: [-3.1, 0.78, 1.7],
  },
  tom: {
    zoneId: "tom-desk",
    zoneLabel: "Tom Desk",
    accent: "#34d399",
    deskPosition: [4.2, 0.4, -0.8],
    avatarPosition: [4.2, 0.78, -0.1],
  },
  joanna: {
    zoneId: "joanna-desk",
    zoneLabel: "Joanna Desk",
    accent: "#f472b6",
    deskPosition: [3.1, 0.4, 2.4],
    avatarPosition: [3.1, 0.78, 1.7],
  },
  ivy: {
    zoneId: "ivy-desk",
    zoneLabel: "Ivy Desk",
    accent: "#22c55e",
    deskPosition: [0, 0.4, 3.1],
    avatarPosition: [0, 0.78, 2.35],
  },
};

const SPECIAL_ZONES: SimsZoneSummary[] = [
  {
    id: "task-wall",
    label: "Task Wall",
    description: "Blocked work and pressure points.",
    accent: "#ef4444",
    position: [0, 1.8, -4.85],
  },
  {
    id: "review-table",
    label: "Review Table",
    description: "In-flight implementation and handoff work.",
    accent: "#a855f7",
    position: [0, 0.85, -0.2],
  },
  {
    id: "break-area",
    label: "Break Area",
    description: "Who is idle, cooling down, or waiting.",
    accent: "#14b8a6",
    position: [0, 0.8, 4.4],
  },
];

function titleCase(name: string) {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function sortTasksByUpdatedDesc(tasks: Task[]) {
  return [...tasks].sort(
    (a, b) => parseUTC(b.updated_at).getTime() - parseUTC(a.updated_at).getTime(),
  );
}

export function normalizeSimsAgent(input: unknown): SimsAgentSnapshot | null {
  if (!input || typeof input !== "object") return null;

  const row = input as {
    name?: unknown;
    avatarUrl?: unknown;
    status?: unknown;
    activityState?: unknown;
    attention?: unknown;
    lastActiveAt?: unknown;
    currentTask?: { id?: unknown; title?: unknown } | null;
  };

  const id = normalizeAgentId(typeof row.name === "string" ? row.name : null);
  if (!id || !(TEAM_AGENT_IDS as readonly string[]).includes(id)) return null;

  return {
    id,
    displayName: titleCase(id),
    role: AGENT_META[id]?.role || "Agent",
    avatarUrl: resolveAgentAvatarUrl(id, typeof row.avatarUrl === "string" ? row.avatarUrl : null),
    status: typeof row.status === "string" ? row.status : "idle",
    activityState: typeof row.activityState === "string" ? row.activityState : "idle",
    attention: typeof row.attention === "string" ? row.attention : "none",
    currentTaskId: typeof row.currentTask?.id === "string" ? row.currentTask.id : null,
    currentTaskTitle: typeof row.currentTask?.title === "string" ? row.currentTask.title : null,
    lastActiveAt:
      typeof row.lastActiveAt === "number" || typeof row.lastActiveAt === "string"
        ? row.lastActiveAt
        : null,
  };
}

function buildActiveTaskIndex(tasks: Task[]) {
  const byId = new Map<string, Task>();
  const byAssignee = new Map<string, Task[]>();

  for (const task of tasks) {
    byId.set(task.id, task);
    if (task.assignee) {
      const current = byAssignee.get(task.assignee) || [];
      current.push(task);
      byAssignee.set(task.assignee, current);
    }
  }

  return { byId, byAssignee };
}

function buildBlockedTaskIndex(tasks: Task[]) {
  const byAssignee = new Map<string, Task[]>();

  for (const task of tasks) {
    if (!task.assignee) continue;
    const current = byAssignee.get(task.assignee) || [];
    current.push(task);
    byAssignee.set(task.assignee, current);
  }

  return byAssignee;
}

export function createSimsRoomState(input: {
  agents: unknown[];
  blockedTasks: Task[];
  activeTasks: Task[];
}): SimsRoomState {
  const normalizedAgents = input.agents
    .map(normalizeSimsAgent)
    .filter((agent): agent is SimsAgentSnapshot => !!agent)
    .sort((a, b) => TEAM_AGENT_IDS.indexOf(a.id as (typeof TEAM_AGENT_IDS)[number]) - TEAM_AGENT_IDS.indexOf(b.id as (typeof TEAM_AGENT_IDS)[number]));

  const blockedTasks = sortTasksByUpdatedDesc(input.blockedTasks);
  const activeTasks = sortTasksByUpdatedDesc(input.activeTasks);
  const blockedByAssignee = buildBlockedTaskIndex(blockedTasks);
  const activeIndex = buildActiveTaskIndex(activeTasks);

  const agents: SimsAgentSceneState[] = normalizedAgents.map((agent) => {
    const layout = DESK_LAYOUT[agent.id];
    const blockedForAgent = blockedByAssignee.get(agent.id) || [];
    const activeTask = agent.currentTaskId
      ? activeIndex.byId.get(agent.currentTaskId) || null
      : (activeIndex.byAssignee.get(agent.id)?.[0] || null);
    const liveStatus = agent.status.toLowerCase();
    const activityState = agent.activityState.toLowerCase();
    const isBusy = liveStatus === "thinking" || activityState === "active" || !!activeTask;
    const hasBlockedTask = blockedForAgent.length > 0 || agent.attention === "aborted_last_run";

    return {
      ...agent,
      zoneId: layout.zoneId,
      zoneLabel: layout.zoneLabel,
      accent: layout.accent,
      deskPosition: layout.deskPosition,
      avatarPosition: layout.avatarPosition,
      activeTask,
      blockedTasks: blockedForAgent,
      isBusy,
      hasBlockedTask,
      mood: hasBlockedTask ? "blocked" : isBusy ? "busy" : "idle",
    };
  });

  const zones: SimsZoneSummary[] = [
    ...agents.map((agent) => ({
      id: agent.zoneId,
      label: agent.zoneLabel,
      description: `${agent.displayName}'s lane in the office.`,
      accent: agent.accent,
      position: agent.deskPosition,
    })),
    ...SPECIAL_ZONES,
  ];

  return {
    agents,
    blockedTasks,
    activeTasks,
    zones,
    activeAgentsCount: agents.filter((agent) => agent.isBusy).length,
    idleAgentsCount: agents.filter((agent) => !agent.isBusy && !agent.hasBlockedTask).length,
  };
}

export function getZoneSummary(room: SimsRoomState, zoneId: SimsZoneId) {
  return room.zones.find((zone) => zone.id === zoneId) || null;
}

export function findRoomAgent(room: SimsRoomState, agentId: string) {
  return room.agents.find((agent) => agent.id === agentId) || null;
}
