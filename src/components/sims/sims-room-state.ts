import { parseUTC } from "@/lib/dates";
import { normalizeAgentId, resolveAgentAvatarUrl, TEAM_AGENT_IDS } from "@/lib/agents";
import type { Task } from "@/lib/api";
import type {
  SimsAgentSceneState,
  SimsAgentSnapshot,
  SimsRoomId,
  SimsRoomState,
  SimsRoomSummary,
  SimsZoneId,
  SimsZoneSummary,
} from "./sims-types";

const AGENT_META: Record<string, { role: string }> = {
  frank: { role: "Orchestrator" },
  tom: { role: "Lead Architect" },
  michael: { role: "Full Stack Engineer" },
  joanna: { role: "UX/Product Designer" },
  ivy: { role: "Venture Researcher" },
};

const ROOMS: SimsRoomSummary[] = [
  {
    id: "main-office",
    label: "Open Office",
    description: "The core task floor with desks, the task wall, and review table.",
  },
  {
    id: "king-office",
    label: "King's Office",
    description: "Derrick's perch for approvals, direction, and pressure points.",
  },
  {
    id: "break-room",
    label: "Break Room",
    description: "A softer corner for idle time, coffee, and decompression.",
  },
  {
    id: "courtyard",
    label: "Outside Patio",
    description: "The outside edge of the office campus for fresh-air moments.",
  },
];

const DESK_LAYOUT: Record<
  string,
  {
    zoneId: SimsZoneId;
    zoneLabel: string;
    accent: string;
    deskPosition: [number, number, number];
    deskAvatarPosition: [number, number, number];
  }
> = {
  frank: {
    zoneId: "frank-desk",
    zoneLabel: "Frank Desk",
    accent: "#60a5fa",
    deskPosition: [-5.8, 0.4, -1.15],
    deskAvatarPosition: [-5.8, 0.78, -0.25],
  },
  michael: {
    zoneId: "michael-desk",
    zoneLabel: "Michael Desk",
    accent: "#f59e0b",
    deskPosition: [-5.2, 0.4, 2.35],
    deskAvatarPosition: [-5.2, 0.78, 1.45],
  },
  tom: {
    zoneId: "tom-desk",
    zoneLabel: "Tom Desk",
    accent: "#34d399",
    deskPosition: [0.4, 0.4, -1.15],
    deskAvatarPosition: [0.4, 0.78, -0.25],
  },
  joanna: {
    zoneId: "joanna-desk",
    zoneLabel: "Joanna Desk",
    accent: "#f472b6",
    deskPosition: [0.9, 0.4, 2.35],
    deskAvatarPosition: [0.9, 0.78, 1.45],
  },
  ivy: {
    zoneId: "ivy-desk",
    zoneLabel: "Ivy Desk",
    accent: "#22c55e",
    deskPosition: [-2.25, 0.4, 3.45],
    deskAvatarPosition: [-2.25, 0.78, 2.55],
  },
};

const SPECIAL_ZONES: SimsZoneSummary[] = [
  {
    id: "task-wall",
    label: "Task Wall",
    description: "Blocked work and pressure points.",
    accent: "#ef4444",
    position: [-2.45, 2.1, -7.15],
    roomId: "main-office",
  },
  {
    id: "review-table",
    label: "Review Table",
    description: "In-flight implementation and handoff work.",
    accent: "#a855f7",
    position: [-2.3, 0.9, 0.15],
    roomId: "main-office",
  },
  {
    id: "break-room",
    label: "Break Room",
    description: "Coffee, decompression, and low-attention moments.",
    accent: "#14b8a6",
    position: [6.4, 0.9, 3.7],
    roomId: "break-room",
  },
  {
    id: "king-office",
    label: "King's Office",
    description: "Derrick's office and executive overview lane.",
    accent: "#f59e0b",
    position: [6.2, 0.9, -2.45],
    roomId: "king-office",
  },
  {
    id: "courtyard",
    label: "Outside Patio",
    description: "The outside edge of the campus, ready for future scenes.",
    accent: "#22c55e",
    position: [0.8, 0.9, 8.15],
    roomId: "courtyard",
  },
];

const BLOCKED_PRESENCE_SPOTS: Array<{
  zoneId: SimsZoneId;
  zoneLabel: string;
  roomId: SimsRoomId;
  position: [number, number, number];
}> = [
  {
    zoneId: "task-wall",
    zoneLabel: "Task Wall",
    roomId: "main-office",
    position: [-3.45, 0.78, -3.95],
  },
  {
    zoneId: "review-table",
    zoneLabel: "Review Table",
    roomId: "main-office",
    position: [-1.3, 0.78, -0.8],
  },
  {
    zoneId: "king-office",
    zoneLabel: "King's Office",
    roomId: "king-office",
    position: [5.15, 0.78, -1.65],
  },
  {
    zoneId: "king-office",
    zoneLabel: "King's Office",
    roomId: "king-office",
    position: [7.2, 0.78, -2.9],
  },
];

const IDLE_PRESENCE_SPOTS: Array<{
  zoneId: SimsZoneId;
  zoneLabel: string;
  roomId: SimsRoomId;
  position: [number, number, number];
}> = [
  {
    zoneId: "break-room",
    zoneLabel: "Break Room",
    roomId: "break-room",
    position: [5.5, 0.78, 3.25],
  },
  {
    zoneId: "break-room",
    zoneLabel: "Break Room",
    roomId: "break-room",
    position: [7.2, 0.78, 4.1],
  },
  {
    zoneId: "courtyard",
    zoneLabel: "Outside Patio",
    roomId: "courtyard",
    position: [-1.55, 0.78, 7.75],
  },
  {
    zoneId: "courtyard",
    zoneLabel: "Outside Patio",
    roomId: "courtyard",
    position: [2.15, 0.78, 8.55],
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

function orderedAgentIndex(agentId: string) {
  const index = TEAM_AGENT_IDS.indexOf(agentId as (typeof TEAM_AGENT_IDS)[number]);
  return index >= 0 ? index : TEAM_AGENT_IDS.length;
}

function resolvePresence(input: {
  agentId: string;
  isBusy: boolean;
  hasBlockedTask: boolean;
  busyFallback: {
    zoneId: SimsZoneId;
    zoneLabel: string;
    roomId: SimsRoomId;
    position: [number, number, number];
  };
}) {
  const orderedIndex = orderedAgentIndex(input.agentId);

  if (input.hasBlockedTask) {
    return BLOCKED_PRESENCE_SPOTS[orderedIndex % BLOCKED_PRESENCE_SPOTS.length];
  }

  if (input.isBusy) {
    return input.busyFallback;
  }

  return IDLE_PRESENCE_SPOTS[orderedIndex % IDLE_PRESENCE_SPOTS.length];
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
    .sort((a, b) => orderedAgentIndex(a.id) - orderedAgentIndex(b.id));

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
    const presence = resolvePresence({
      agentId: agent.id,
      isBusy,
      hasBlockedTask,
      busyFallback: {
        zoneId: layout.zoneId,
        zoneLabel: layout.zoneLabel,
        roomId: "main-office",
        position: layout.deskAvatarPosition,
      },
    });

    return {
      ...agent,
      zoneId: layout.zoneId,
      zoneLabel: layout.zoneLabel,
      accent: layout.accent,
      deskPosition: layout.deskPosition,
      avatarPosition: presence.position,
      currentZoneId: presence.zoneId,
      currentZoneLabel: presence.zoneLabel,
      currentRoomId: presence.roomId,
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
      description: `${agent.displayName}'s assigned desk in the open office.`,
      accent: agent.accent,
      position: agent.deskPosition,
      roomId: "main-office" as const,
    })),
    ...SPECIAL_ZONES,
  ];

  return {
    agents,
    blockedTasks,
    activeTasks,
    zones,
    rooms: ROOMS,
    roomCount: ROOMS.length,
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
