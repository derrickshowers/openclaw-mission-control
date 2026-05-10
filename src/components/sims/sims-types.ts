import type { Task } from "@/lib/api";

export type SimsRoomId = "main-office" | "king-office" | "break-room" | "courtyard";

export type SimsZoneId =
  | "frank-desk"
  | "tom-desk"
  | "michael-desk"
  | "joanna-desk"
  | "ivy-desk"
  | "task-wall"
  | "review-table"
  | "break-room"
  | "king-office"
  | "courtyard";

export type SimsPanelTarget =
  | { kind: "overview" }
  | { kind: "agent"; agentId: string }
  | { kind: "zone"; zoneId: SimsZoneId };

export interface SimsAgentSnapshot {
  id: string;
  displayName: string;
  role: string;
  avatarUrl: string | null;
  status: string;
  activityState: string;
  attention: string;
  currentTaskId: string | null;
  currentTaskTitle: string | null;
  lastActiveAt: string | number | null;
}

export interface SimsAgentSceneState extends SimsAgentSnapshot {
  zoneId: SimsZoneId;
  zoneLabel: string;
  accent: string;
  deskPosition: [number, number, number];
  avatarPosition: [number, number, number];
  currentZoneId: SimsZoneId;
  currentZoneLabel: string;
  currentRoomId: SimsRoomId;
  activeTask: Task | null;
  blockedTasks: Task[];
  isBusy: boolean;
  hasBlockedTask: boolean;
  mood: "busy" | "blocked" | "idle";
}

export interface SimsZoneSummary {
  id: SimsZoneId;
  label: string;
  description: string;
  accent: string;
  position: [number, number, number];
  roomId: SimsRoomId;
}

export interface SimsRoomSummary {
  id: SimsRoomId;
  label: string;
  description: string;
}

export interface SimsRoomState {
  agents: SimsAgentSceneState[];
  blockedTasks: Task[];
  activeTasks: Task[];
  zones: SimsZoneSummary[];
  rooms: SimsRoomSummary[];
  roomCount: number;
  activeAgentsCount: number;
  idleAgentsCount: number;
}
