"use client";

import type { ReactNode } from "react";
import { Avatar, Button, Card, CardBody, Chip } from "@heroui/react";
import {
  AlertTriangle,
  ArrowRight,
  Coffee,
  Crown,
  Move,
  RefreshCw,
  Trees,
  Workflow,
} from "lucide-react";
import { parseUTC, timeAgo } from "@/lib/dates";
import type { Task } from "@/lib/api";
import { findRoomAgent, getZoneSummary } from "./sims-room-state";
import type { SimsAgentSceneState, SimsPanelTarget, SimsRoomState, SimsZoneId } from "./sims-types";

interface SimsStatusStripProps {
  room: SimsRoomState;
  refreshing: boolean;
  motionEnabled: boolean;
  onRefresh: () => void;
  onResetCamera: () => void;
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
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{agent.displayName}</p>
              <Chip size="sm" variant="flat" color={liveStatusColor(agent)} className="h-5 text-[10px] uppercase">
                {liveStatusLabel(agent)}
              </Chip>
            </div>
            <p className="text-[12px] text-zinc-500 dark:text-zinc-400">{agent.role}</p>
            <p className="mt-1 text-[12px] text-zinc-500 dark:text-zinc-400">
              {agent.currentTaskTitle || "No current task surfaced"}
            </p>
            <p className="mt-1 text-[12px] text-zinc-500 dark:text-zinc-400">
              Currently in {agent.currentZoneLabel}
            </p>
          </div>
          <ArrowRight size={16} className="text-zinc-400" />
        </CardBody>
      </Card>
    </button>
  );
}

function ZoneQuickCard({
  icon,
  title,
  body,
  onSelect,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  onSelect: () => void;
}) {
  return (
    <button type="button" onClick={onSelect} className="w-full text-left">
      <Card className={panelCardClassName()}>
        <CardBody className="flex flex-row items-center justify-between gap-3 p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200">
              {icon}
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</p>
              <p className="mt-1 text-[12px] text-zinc-500 dark:text-zinc-400">{body}</p>
            </div>
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
  onResetCamera,
  onToggleMotion,
}: SimsStatusStripProps) {
  const telemetry = [
    { label: "Rooms", value: String(room.roomCount), tone: "default" as const },
    { label: "Active agents", value: String(room.activeAgentsCount), tone: "default" as const },
    { label: "Blocked", value: String(room.blockedTasks.length), tone: "danger" as const },
    { label: "In flight", value: String(room.activeTasks.length), tone: "warning" as const },
  ];

  return (
    <Card className="rounded-2xl border border-zinc-200 bg-white shadow-none dark:border-white/10 dark:bg-[#0f0f0f]">
      <CardBody className="gap-3 p-3 sm:p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Chip
                size="sm"
                variant="flat"
                className="h-6 border border-violet-200 bg-violet-50 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300"
                startContent={<Trees size={12} />}
              >
                Environment beta
              </Chip>
              <p className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">Multi-room campus</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Office, break room, King&apos;s office, and patio in one frame.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {telemetry.map((item) => (
              <Chip
                key={item.label}
                size="sm"
                variant="flat"
                color={item.tone === "danger" ? "danger" : item.tone === "warning" ? "warning" : "default"}
                className="h-7 px-2.5 text-[11px]"
              >
                <span className="font-medium text-zinc-500 dark:text-zinc-400">{item.label}</span>
                <span className="ml-1.5 font-semibold text-zinc-950 dark:text-zinc-50">{item.value}</span>
              </Chip>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="flat"
            className="rounded-full border border-zinc-200 bg-zinc-100 dark:border-white/10 dark:bg-white/5"
            startContent={<RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />}
            onPress={onRefresh}
            isDisabled={refreshing}
          >
            Refresh data
          </Button>
          <Button
            size="sm"
            variant="flat"
            className="rounded-full border border-zinc-200 bg-zinc-100 dark:border-white/10 dark:bg-white/5"
            startContent={<Move size={14} />}
            onPress={onResetCamera}
          >
            Reset view
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
      </CardBody>
    </Card>
  );
}

function agentsInZone(room: SimsRoomState, zoneId: SimsZoneId) {
  return room.agents.filter((agent) => agent.currentZoneId === zoneId);
}

export function SimsInspectorPanel({
  room,
  selectedTarget,
  onSelectTarget,
  onOpenTask,
}: SimsInspectorPanelProps) {
  let title = "Environment overview";
  let eyebrow = "Campus at a glance";
  let body: React.ReactNode = (
    <div className="space-y-4">
      <Card className={panelCardClassName()}>
        <CardBody className="gap-3 p-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Drag across the world to move, zoom in to inspect desks, and pull back to read the office,
            break room, King&apos;s office, and patio as one connected environment.
          </p>
          <div className="grid gap-3">
            <ZoneQuickCard
              icon={<AlertTriangle size={16} />}
              title="Task Wall"
              body={`${room.blockedTasks.length} blocked tasks need attention.`}
              onSelect={() => onSelectTarget({ kind: "zone", zoneId: "task-wall" })}
            />
            <ZoneQuickCard
              icon={<Workflow size={16} />}
              title="Review Table"
              body={`${room.activeTasks.length} active tasks are currently moving.`}
              onSelect={() => onSelectTarget({ kind: "zone", zoneId: "review-table" })}
            />
            <ZoneQuickCard
              icon={<Coffee size={16} />}
              title="Break Room"
              body={`${agentsInZone(room, "break-room").length} teammates are currently hanging here.`}
              onSelect={() => onSelectTarget({ kind: "zone", zoneId: "break-room" })}
            />
            <ZoneQuickCard
              icon={<Crown size={16} />}
              title="King's Office"
              body="A dedicated Derrick zone for direction, approvals, and escalations." 
              onSelect={() => onSelectTarget({ kind: "zone", zoneId: "king-office" })}
            />
            <ZoneQuickCard
              icon={<Trees size={16} />}
              title="Outside Patio"
              body={`${agentsInZone(room, "courtyard").length} teammates are taking the edge off outside.`}
              onSelect={() => onSelectTarget({ kind: "zone", zoneId: "courtyard" })}
            />
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
                      {agent.currentZoneLabel}
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
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-white/5">
                  <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Current room</p>
                  <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-200">{agent.currentZoneLabel}</p>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-white/5">
                  <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">Assigned desk</p>
                  <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-200">{agent.zoneLabel}</p>
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

    if (selectedTarget.zoneId === "break-room") {
      const breakRoomAgents = agentsInZone(room, "break-room");
      body = (
        <div className="space-y-4">
          <Card className={panelCardClassName()}>
            <CardBody className="gap-3 p-5">
              <div className="inline-flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">
                <Coffee size={16} />
                Coffee, decompression, and lighter presence.
              </div>
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                This room gives the scene somewhere softer to breathe when people are idle instead of keeping everyone glued to their desks.
              </p>
            </CardBody>
          </Card>
          {breakRoomAgents.length === 0 ? (
            <Card className={panelCardClassName()}>
              <CardBody className="p-4 text-sm text-zinc-500 dark:text-zinc-400">
                Nobody is in the break room right now.
              </CardBody>
            </Card>
          ) : (
            <div className="space-y-3">
              {breakRoomAgents.map((agent) => (
                <AgentQuickCard key={agent.id} agent={agent} onSelect={() => onSelectTarget({ kind: "agent", agentId: agent.id })} />
              ))}
            </div>
          )}
        </div>
      );
    }

    if (selectedTarget.zoneId === "king-office") {
      const pressureTasks = room.blockedTasks.length > 0 ? room.blockedTasks.slice(0, 3) : room.activeTasks.slice(0, 3);
      body = (
        <div className="space-y-4">
          <Card className={panelCardClassName()}>
            <CardBody className="gap-3 p-5">
              <div className="inline-flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">
                <Crown size={16} />
                Derrick&apos;s executive perch.
              </div>
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                This is the room that can grow into approvals, escalations, and higher-level direction. For now it gives the campus a dedicated place to stage the work that matters most.
              </p>
            </CardBody>
          </Card>
          <TaskList
            tasks={pressureTasks}
            emptyMessage="No urgent work is bubbling up to the King's office right now."
            accentClassName="border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
            onOpenTask={onOpenTask}
          />
        </div>
      );
    }

    if (selectedTarget.zoneId === "courtyard") {
      const courtyardAgents = agentsInZone(room, "courtyard");
      body = (
        <div className="space-y-4">
          <Card className={panelCardClassName()}>
            <CardBody className="gap-3 p-5">
              <div className="inline-flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">
                <Trees size={16} />
                The outside edge of the office.
              </div>
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                Pull back and you can finally see the campus breathing a bit — not just a single room, but an office with some world around it.
              </p>
            </CardBody>
          </Card>
          {courtyardAgents.length === 0 ? (
            <Card className={panelCardClassName()}>
              <CardBody className="p-4 text-sm text-zinc-500 dark:text-zinc-400">
                Nobody is outside right now.
              </CardBody>
            </Card>
          ) : (
            <div className="space-y-3">
              {courtyardAgents.map((agent) => (
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
