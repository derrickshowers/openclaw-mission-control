"use client";

import type { ReactNode } from "react";
import { Avatar, Button, Card, CardBody, Chip } from "@heroui/react";
import { ArrowRight, AlertTriangle, Coffee, RefreshCw, Sparkles, Users, Workflow } from "lucide-react";
import { parseUTC, timeAgo } from "@/lib/dates";
import type { Task } from "@/lib/api";
import { findRoomAgent, getZoneSummary } from "./sims-room-state";
import type { SimsAgentSceneState, SimsPanelTarget, SimsRoomState } from "./sims-types";

interface SimsStatusStripProps {
  room: SimsRoomState;
  refreshing: boolean;
  motionEnabled: boolean;
  onRefresh: () => void;
  onToggleMotion: () => void;
}

interface SimsInspectorPanelProps {
  room: SimsRoomState;
  selectedTarget: SimsPanelTarget;
  onSelectTarget: (target: SimsPanelTarget) => void;
  onOpenTask: (task: Task) => void;
}

function panelCardClassName(active?: boolean) {
  return active
    ? "rounded-2xl border border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-950"
    : "rounded-2xl border border-zinc-200 bg-white text-zinc-900 shadow-none dark:border-white/10 dark:bg-[#0f0f0f] dark:text-zinc-100";
}

function formatLastActive(lastActiveAt: string | number | null) {
  if (!lastActiveAt) return "No recent session";
  const parsed = parseUTC(lastActiveAt);
  if (Number.isNaN(parsed.getTime())) return "No recent session";
  return timeAgo(parsed.toISOString());
}

function liveStatusLabel(agent: SimsAgentSceneState) {
  if (agent.hasBlockedTask) return "Needs attention";
  if (agent.isBusy) return "Working now";
  return "Idle";
}

function liveStatusColor(agent: SimsAgentSceneState) {
  if (agent.hasBlockedTask) return "danger" as const;
  if (agent.isBusy) return "warning" as const;
  return "success" as const;
}

function TaskList({
  tasks,
  emptyMessage,
  accentClassName,
  onOpenTask,
}: {
  tasks: Task[];
  emptyMessage: string;
  accentClassName: string;
  onOpenTask: (task: Task) => void;
}) {
  if (tasks.length === 0) {
    return (
      <Card className={panelCardClassName()}>
        <CardBody className="p-4 text-sm text-zinc-500 dark:text-zinc-400">{emptyMessage}</CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <Card key={task.id} className={panelCardClassName()}>
          <CardBody className="gap-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{task.title}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Chip size="sm" variant="flat" className={`h-5 text-[10px] uppercase ${accentClassName}`}>
                    {task.status.replace("_", " ")}
                  </Chip>
                  {task.assignee ? (
                    <Chip size="sm" variant="flat" className="h-5 border border-zinc-200 bg-zinc-100 text-[10px] uppercase dark:border-white/10 dark:bg-white/5">
                      @{task.assignee}
                    </Chip>
                  ) : null}
                </div>
                <p className="mt-2 text-[12px] text-zinc-500 dark:text-zinc-400">
                  Updated {timeAgo(task.updated_at)}
                </p>
                {task.description ? (
                  <p className="mt-2 line-clamp-3 text-[13px] text-zinc-600 dark:text-zinc-300">{task.description}</p>
                ) : null}
              </div>
              <Button size="sm" variant="flat" className="rounded-full" onPress={() => onOpenTask(task)}>
                Open
              </Button>
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}

function AgentQuickCard({
  agent,
  onSelect,
}: {
  agent: SimsAgentSceneState;
  onSelect: () => void;
}) {
  return (
    <button type="button" onClick={onSelect} className="w-full text-left">
      <Card className={panelCardClassName()}>
        <CardBody className="flex flex-row items-center gap-3 p-4">
          <Avatar src={agent.avatarUrl || undefined} name={agent.displayName} className="h-10 w-10" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{agent.displayName}</p>
              <Chip size="sm" variant="flat" color={liveStatusColor(agent)} className="h-5 text-[10px] uppercase">
                {liveStatusLabel(agent)}
              </Chip>
            </div>
            <p className="text-[12px] text-zinc-500 dark:text-zinc-400">{agent.role}</p>
            <p className="mt-1 text-[12px] text-zinc-500 dark:text-zinc-400">
              {agent.currentTaskTitle || "No current task surfaced"}
            </p>
          </div>
          <ArrowRight size={16} className="text-zinc-400" />
        </CardBody>
      </Card>
    </button>
  );
}

export function SimsStatusStrip({
  room,
  refreshing,
  motionEnabled,
  onRefresh,
  onToggleMotion,
}: SimsStatusStripProps) {
  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))]">
      <Card className="rounded-3xl border border-zinc-200 bg-white shadow-none dark:border-white/10 dark:bg-[#0f0f0f]">
        <CardBody className="gap-3 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-500 dark:border-white/10 dark:bg-white/5 dark:text-zinc-400">
                <Sparkles size={12} />
                Environment
                <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-purple-700 dark:bg-purple-500/15 dark:text-purple-300">
                  Beta
                </span>
              </div>
              <h2 className="mt-3 text-xl font-semibold text-zinc-950 dark:text-zinc-50">Team-only office mode, wired to live Mission Control data.</h2>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                Click desks, the task wall, or the review table to open real task context without leaving the room.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button
                size="sm"
                variant="flat"
                className="rounded-full border border-zinc-200 bg-zinc-100 dark:border-white/10 dark:bg-white/5"
                startContent={<RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />}
                onPress={onRefresh}
                isDisabled={refreshing}
              >
                Refresh
              </Button>
              <Button
                size="sm"
                variant="flat"
                className="rounded-full border border-zinc-200 bg-zinc-100 dark:border-white/10 dark:bg-white/5"
                onPress={onToggleMotion}
              >
                {motionEnabled ? "Reduce motion" : "Enable motion"}
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      <MetricCard icon={<Users size={14} />} label="Active agents" value={String(room.activeAgentsCount)} note={`${room.agents.length} in room`} />
      <MetricCard icon={<AlertTriangle size={14} />} label="Blocked tasks" value={String(room.blockedTasks.length)} note="Task wall hotspot" tone="danger" />
      <MetricCard icon={<Workflow size={14} />} label="In-flight work" value={String(room.activeTasks.length)} note="Review table hotspot" tone="warning" />
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  note,
  tone = "default",
}: {
  icon: ReactNode;
  label: string;
  value: string;
  note: string;
  tone?: "default" | "warning" | "danger";
}) {
  const iconClassName =
    tone === "danger"
      ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
        : "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200";

  return (
    <Card className="rounded-3xl border border-zinc-200 bg-white shadow-none dark:border-white/10 dark:bg-[#0f0f0f]">
      <CardBody className="gap-3 p-5">
        <div className={`inline-flex h-9 w-9 items-center justify-center rounded-2xl border ${iconClassName}`}>
          {icon}
        </div>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">{value}</p>
          <p className="mt-1 text-[12px] text-zinc-500 dark:text-zinc-400">{note}</p>
        </div>
      </CardBody>
    </Card>
  );
}

export function SimsInspectorPanel({
  room,
  selectedTarget,
  onSelectTarget,
  onOpenTask,
}: SimsInspectorPanelProps) {
  let title = "Office overview";
  let eyebrow = "Start here";
  let body: React.ReactNode = (
    <div className="space-y-4">
      <Card className={panelCardClassName()}>
        <CardBody className="gap-3 p-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            This first pass keeps the game feel in the scene and the dense workflow in normal Mission Control panels.
          </p>
          <div className="grid gap-3">
            <button type="button" onClick={() => onSelectTarget({ kind: "zone", zoneId: "task-wall" })}>
              <Card className={panelCardClassName()}>
                <CardBody className="flex flex-row items-center justify-between gap-3 p-4">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Task Wall</p>
                    <p className="text-[12px] text-zinc-500 dark:text-zinc-400">{room.blockedTasks.length} blocked tasks need attention.</p>
                  </div>
                  <ArrowRight size={16} className="text-zinc-400" />
                </CardBody>
              </Card>
            </button>
            <button type="button" onClick={() => onSelectTarget({ kind: "zone", zoneId: "review-table" })}>
              <Card className={panelCardClassName()}>
                <CardBody className="flex flex-row items-center justify-between gap-3 p-4">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Review Table</p>
                    <p className="text-[12px] text-zinc-500 dark:text-zinc-400">{room.activeTasks.length} active tasks are currently in motion.</p>
                  </div>
                  <ArrowRight size={16} className="text-zinc-400" />
                </CardBody>
              </Card>
            </button>
            <button type="button" onClick={() => onSelectTarget({ kind: "zone", zoneId: "break-area" })}>
              <Card className={panelCardClassName()}>
                <CardBody className="flex flex-row items-center justify-between gap-3 p-4">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Break Area</p>
                    <p className="text-[12px] text-zinc-500 dark:text-zinc-400">{room.idleAgentsCount} teammates are idle right now.</p>
                  </div>
                  <ArrowRight size={16} className="text-zinc-400" />
                </CardBody>
              </Card>
            </button>
          </div>
        </CardBody>
      </Card>

      <div className="space-y-3">
        {room.agents.map((agent) => (
          <AgentQuickCard key={agent.id} agent={agent} onSelect={() => onSelectTarget({ kind: "agent", agentId: agent.id })} />
        ))}
      </div>
    </div>
  );

  if (selectedTarget.kind === "agent") {
    const agent = findRoomAgent(room, selectedTarget.agentId);
    if (agent) {
      title = agent.displayName;
      eyebrow = agent.role;
      body = (
        <div className="space-y-4">
          <Card className={panelCardClassName()}>
            <CardBody className="gap-4 p-5">
              <div className="flex items-center gap-3">
                <Avatar src={agent.avatarUrl || undefined} name={agent.displayName} className="h-14 w-14" />
                <div>
                  <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{agent.displayName}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Chip size="sm" variant="flat" color={liveStatusColor(agent)} className="h-5 text-[10px] uppercase">
                      {liveStatusLabel(agent)}
                    </Chip>
                    <Chip size="sm" variant="flat" className="h-5 border border-zinc-200 bg-zinc-100 text-[10px] uppercase dark:border-white/10 dark:bg-white/5">
                      {agent.zoneLabel}
                    </Chip>
                  </div>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-white/5">
                  <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Presence</p>
                  <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-200">
                    {agent.currentTaskTitle || "No surfaced task right now."}
                  </p>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-white/5">
                  <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Last active</p>
                  <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-200">{formatLastActive(agent.lastActiveAt)}</p>
                </div>
              </div>
              {agent.activeTask ? (
                <Button size="sm" color="primary" className="rounded-full" onPress={() => onOpenTask(agent.activeTask!)}>
                  Open current task
                </Button>
              ) : null}
            </CardBody>
          </Card>

          {agent.blockedTasks.length > 0 ? (
            <TaskList
              tasks={agent.blockedTasks}
              emptyMessage="No blocked tasks for this agent."
              accentClassName="border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
              onOpenTask={onOpenTask}
            />
          ) : (
            <Card className={panelCardClassName()}>
              <CardBody className="p-4 text-sm text-zinc-500 dark:text-zinc-400">
                No blocked tasks assigned here right now.
              </CardBody>
            </Card>
          )}
        </div>
      );
    }
  }

  if (selectedTarget.kind === "zone") {
    const zone = getZoneSummary(room, selectedTarget.zoneId);
    title = zone?.label || title;
    eyebrow = zone?.description || eyebrow;

    if (selectedTarget.zoneId === "task-wall") {
      body = (
        <TaskList
          tasks={room.blockedTasks}
          emptyMessage="No blocked tasks right now — the wall is clear."
          accentClassName="border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
          onOpenTask={onOpenTask}
        />
      );
    }

    if (selectedTarget.zoneId === "review-table") {
      body = (
        <TaskList
          tasks={room.activeTasks}
          emptyMessage="Nothing is in the review lane at the moment."
          accentClassName="border border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300"
          onOpenTask={onOpenTask}
        />
      );
    }

    if (selectedTarget.zoneId === "break-area") {
      const idleAgents = room.agents.filter((agent) => !agent.isBusy && !agent.hasBlockedTask);
      body = (
        <div className="space-y-4">
          <Card className={panelCardClassName()}>
            <CardBody className="gap-3 p-5">
              <div className="inline-flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">
                <Coffee size={16} />
                A soft landing spot for quieter moments.
              </div>
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                Idle teammates stay here instead of pulling attention away from the active desks.
              </p>
            </CardBody>
          </Card>
          {idleAgents.length === 0 ? (
            <Card className={panelCardClassName()}>
              <CardBody className="p-4 text-sm text-zinc-500 dark:text-zinc-400">
                Nobody is idle right now — the whole room is in motion.
              </CardBody>
            </Card>
          ) : (
            <div className="space-y-3">
              {idleAgents.map((agent) => (
                <AgentQuickCard key={agent.id} agent={agent} onSelect={() => onSelectTarget({ kind: "agent", agentId: agent.id })} />
              ))}
            </div>
          )}
        </div>
      );
    }
  }

  return (
    <Card className="rounded-[28px] border border-zinc-200 bg-white shadow-none dark:border-white/10 dark:bg-[#0f0f0f]">
      <CardBody className="gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{eyebrow}</p>
            <h3 className="mt-2 text-xl font-semibold text-zinc-950 dark:text-zinc-50">{title}</h3>
          </div>
          {selectedTarget.kind !== "overview" ? (
            <Button size="sm" variant="flat" className="rounded-full" onPress={() => onSelectTarget({ kind: "overview" })}>
              Back to overview
            </Button>
          ) : null}
        </div>
        {body}
      </CardBody>
    </Card>
  );
}
