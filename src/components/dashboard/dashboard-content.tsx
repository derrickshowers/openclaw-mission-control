"use client";

import { useState } from "react";
import { Button, Card, CardBody, CardHeader, Chip } from "@heroui/react";
import { Crown, Crosshair, Landmark, Zap, Palette, Bot, Users, ListChecks, ArrowRight, ShieldAlert, User, TriangleAlert, Clock, Calendar } from "lucide-react";
import { api } from "@/lib/api";
import type { LucideIcon } from "lucide-react";
import type { Task, PersonalTask } from "@/lib/api";
import { timeAgo as timeAgoUtil } from "@/lib/dates";
import { normalizeAgentId, resolveAgentAvatarUrl } from "@/lib/agents";

interface ActivityEntry {
  id: number;
  seq: number;
  event_type: string;
  agent: string | null;
  payload: Record<string, any>;
  created_at: string;
}

interface DashboardContentProps {
  personalSummary?: any;
  personalTasks?: PersonalTask[];
  tasks: Task[];
  agents: any[];
  status: any;
  recentActivity: ActivityEntry[];
}

const priorityLabels: Record<number, { label: string; color: "default" | "warning" | "danger" }> = {
  0: { label: "None", color: "default" },
  1: { label: "Low", color: "default" },
  2: { label: "Medium", color: "warning" },
  3: { label: "High", color: "danger" },
  4: { label: "Urgent", color: "danger" },
};

const agentRoles: Record<string, string> = {
  derrick: "Founder",
  frank: "Orchestrator",
  tom: "Lead Architect",
  michael: "Full Stack Engineer",
  joanna: "UX/Product Designer",
  elena: "OpenClaw Platform Specialist",
};

const agentIcons: Record<string, LucideIcon> = {
  derrick: Crown,
  frank: Crosshair,
  tom: Landmark,
  michael: Zap,
  joanna: Palette,
  elena: Bot,
};

const eventTypeColors: Record<string, "default" | "primary" | "success" | "warning" | "danger"> = {
  "task.created": "primary",
  "task.updated": "default",
  "task.deleted": "danger",
  "task.moved": "warning",
  "agent.session.start": "success",
  "agent.session.end": "default",
  "agent.tool.call": "default",
  "agent.error": "danger",
};

function formatEventPayload(payload: Record<string, any>): string {
  if (payload.task?.title) return payload.task.title;
  if (payload.message) return payload.message;
  if (payload.summary) return payload.summary;
  if (payload.tool) return `${payload.tool}(${payload.target || ""})`;
  return JSON.stringify(payload).slice(0, 80);
}

const timeAgo = timeAgoUtil;

const activityStateConfig: Record<string, { color: "success" | "warning" | "default" | "primary" | "secondary"; label: string; pulse?: boolean }> = {
  active: { color: "success", label: "active", pulse: true },
  recently_active: { color: "primary", label: "active" },
  idle: { color: "default", label: "idle" },
  stale: { color: "default", label: "stale" },
  uninitialized: { color: "default", label: "none" },
};

export function DashboardContent({ tasks, agents, status, recentActivity, personalSummary, personalTasks = [] }: DashboardContentProps) {
  const inProgress = tasks.filter((t) => t.status === "in_progress");
  const blocked = tasks.filter((t) => t.status === "blocked");
  const done = tasks.filter((t) => t.status === "done");
  const backlog = tasks.filter((t) => t.status === "backlog");

  const [isRestarting, setIsRestarting] = useState(false);
  const [doctorRunning, setDoctorRunning] = useState(false);
  const [doctorOutput, setDoctorOutput] = useState<string>("");
  const [doctorCommand, setDoctorCommand] = useState<string>("");

  async function handleRestart() {
    setIsRestarting(true);
    try {
      await api.restartOpenClaw();
    } catch {
      // keep silent in UI for now; doctor panel is the detailed diagnostics surface
    } finally {
      setIsRestarting(false);
    }
  }

  async function handleDoctor(fix = false) {
    setDoctorRunning(true);
    try {
      const res = await api.runDoctor(fix);
      setDoctorCommand(res.command || `openclaw doctor${fix ? " --fix" : ""}`);
      const output = [res.stdout, res.stderr].filter(Boolean).join("\n");
      setDoctorOutput(output || "(no output)");
    } catch (error: any) {
      setDoctorCommand(`openclaw doctor${fix ? " --fix" : ""}`);
      setDoctorOutput(error?.message || "Failed to run doctor");
    } finally {
      setDoctorRunning(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1280px] space-y-4">
      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Backlog" value={backlog.length} />
        <StatCard label="In Progress" value={inProgress.length} />
        <StatCard label="Blocked" value={blocked.length} />
        <StatCard label="Completed" value={done.length} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        {/* Active Agents */}
        <Card className="border border-divider bg-content1/50 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
          <CardHeader className="border-b border-divider px-4 py-2.5">
            <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-foreground-400">
              <Users size={16} strokeWidth={1.5} className="text-foreground-300" />
              Team
            </span>
          </CardHeader>
          <CardBody className="gap-2 p-3">
            {Object.keys(agentRoles).map((name) => {
              const agent = agents.find((a: any) => normalizeAgentId(a.name) === name) || { name };
              const activity = activityStateConfig[agent.activityState] || activityStateConfig.uninitialized;
              const hasTask = inProgress.some(t => normalizeAgentId(t.assignee) === name);
              const avatarUrl = resolveAgentAvatarUrl(agent.name, agent.avatarUrl);

              let displayColor = activity.color;
              let displayLabel = activity.label;
              if (displayLabel === "idle" && hasTask) {
                displayColor = "warning";
                displayLabel = "working";
              }

              return (
              <div
                key={agent.name}
                className="flex items-center justify-between rounded-lg border border-divider bg-content2/50 px-3 py-2 backdrop-blur transition-colors hover:bg-content2/80"
              >
                <div className="flex items-center gap-3">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={agent.name}
                      className="h-7 w-7 rounded-full object-cover border border-divider"
                    />
                  ) : (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 dark:bg-default-100 text-foreground-400">
                      {(() => { const Icon = agentIcons[normalizeAgentId(agent.name) || ""] || Bot; return <Icon size={16} strokeWidth={1.5} />; })()}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium capitalize">{agent.name}</p>
                    <p className="text-xs text-foreground-400">
                      {agentRoles[normalizeAgentId(agent.name) || ""] || "Agent"}
                    </p>
                  </div>
                </div>
                <Chip size="sm" variant="flat" color={displayColor as any} className={`text-xs ${activity.pulse ? "animate-pulse" : ""}`}>
                  {displayLabel}
                </Chip>
              </div>
              );
            })}
          </CardBody>
        </Card>

        {/* Urgent / In-Progress Tasks */}
        <Card className="border border-divider bg-content1/50 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
          <CardHeader className="border-b border-divider px-4 py-2.5">
            <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-foreground-400">
              <ListChecks size={16} strokeWidth={1.5} className="text-foreground-300" />
              Active Tasks
            </span>
          </CardHeader>
          <CardBody className="gap-2 p-3">
            {inProgress.length === 0 && blocked.length === 0 ? (
              <p className="py-4 text-center text-sm text-foreground-400 font-mono">
                No active tasks. Take a breath.
              </p>
            ) : (
              [...blocked, ...inProgress].slice(0, 5).map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between rounded-lg border border-divider bg-content2/50 px-3 py-2 backdrop-blur transition-colors hover:bg-content2/80"
                >
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium">{task.title}</p>
                    <p className="text-xs text-foreground-400 flex items-center gap-1.5 mt-0.5">
                      {task.assignee && resolveAgentAvatarUrl(task.assignee) ? (
                        <img src={resolveAgentAvatarUrl(task.assignee)!} alt={task.assignee} className="h-4 w-4 rounded-full object-cover border border-divider" />
                      ) : null}
                      {task.assignee ? `→ ${task.assignee}` : "Unassigned"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {task.priority > 0 && (
                      <Chip
                        size="sm"
                        variant="flat"
                        color={priorityLabels[task.priority]?.color || "default"}
                        className="text-[10px] h-5"
                      >
                        {priorityLabels[task.priority]?.label}
                      </Chip>
                    )}
                    <Chip
                      size="sm"
                      variant="flat"
                      color={task.status === "blocked" ? "danger" : "primary"}
                      className="text-[10px] h-5"
                    >
                      {task.status === "in_progress" ? "active" : task.status}
                    </Chip>
                  </div>
                </div>
              ))
            )}
          </CardBody>
        </Card>
      {/* Personal Backlog Widget */}
      {personalSummary && (
        <PersonalBacklogWidget
          personalSummary={personalSummary}
          personalTasks={personalTasks}
        />
      )}

      </div>

      <Card className="border border-divider bg-content1/50 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
        <CardHeader className="border-b border-divider px-4 py-2.5">
          <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-foreground-400">
            <ShieldAlert size={16} strokeWidth={1.5} className="text-foreground-300" />
            OpenClaw Controls
          </span>
        </CardHeader>
        <CardBody className="gap-3 p-3">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" color="danger" onPress={handleRestart} isLoading={isRestarting}>
              Restart OpenClaw
            </Button>
            <Button size="sm" variant="flat" onPress={() => handleDoctor(false)} isLoading={doctorRunning}>
              Run Doctor
            </Button>
            <Button size="sm" variant="flat" color="warning" onPress={() => handleDoctor(true)} isLoading={doctorRunning}>
              Run Doctor --fix
            </Button>
          </div>

          <div className="rounded-lg border border-divider bg-content2/50 p-3 backdrop-blur">
            <p className="text-[10px] text-foreground-400 font-mono mb-2 uppercase tracking-wide">
              {doctorCommand || "Run doctor to see diagnostics output"}
            </p>
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap font-mono text-xs text-foreground-500">
              {doctorOutput || "(no output yet)"}
            </pre>
          </div>
        </CardBody>
      </Card>

      {/* Recent Activity */}
      <Card className="border border-divider bg-content1/50 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
        <CardHeader className="border-b border-divider px-4 py-2.5">
          <div className="flex w-full items-center justify-between">
            <h2 className="text-[11px] font-medium uppercase tracking-wider text-foreground-400">Recent Activity</h2>
            <a href="/activity" className="flex items-center gap-1 text-xs text-foreground-400 hover:text-foreground transition-colors">
              View all <ArrowRight size={12} strokeWidth={1.5} />
            </a>
          </div>
        </CardHeader>
        <CardBody className="p-0">
          {recentActivity.length === 0 ? (
            <p className="py-6 text-center font-mono text-xs text-foreground-400">
              No recent activity
            </p>
          ) : (
            <div className="divide-y divide-divider">
              {recentActivity.slice(0, 5).map((entry, i) => (
                <div
                  key={entry.id || i}
                  className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-default-100/50"
                >
                  <Chip
                    size="sm"
                    variant="flat"
                    color={eventTypeColors[entry.event_type] || "default"}
                    className="flex-shrink-0 text-[10px] h-5"
                  >
                    {entry.event_type}
                  </Chip>
                  {entry.agent && (
                    <span className="flex-shrink-0 text-xs text-foreground-400 capitalize w-14 font-mono">
                      {entry.agent}
                    </span>
                  )}
                  <span className="flex-1 truncate font-mono text-xs text-foreground-500">
                    {formatEventPayload(entry.payload)}
                  </span>
                  <span className="flex-shrink-0 text-[10px] text-foreground-400 font-mono">
                    {timeAgo(entry.created_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

// ── Personal Backlog helpers ──────────────────────────────────────────────────

type TaskUrgency = "overdue" | "today" | "other";

function getTaskUrgency(task: PersonalTask): TaskUrgency {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (task.due_at) {
    const due = new Date(task.due_at);
    const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
    if (dueDay < today) return "overdue";
    if (dueDay.getTime() === today.getTime()) return "today";
  }
  return "other";
}

function urgencyOrder(u: TaskUrgency): number {
  if (u === "overdue") return 0;
  if (u === "today") return 1;
  return 2;
}

function formatTaskMeta(task: PersonalTask, urgency: TaskUrgency): string {
  if (urgency === "overdue" && task.due_at) {
    const ms = Date.now() - new Date(task.due_at).getTime();
    const days = Math.floor(ms / 86400000);
    return days <= 0 ? "Overdue" : `Overdue ${days}d`;
  }
  if (urgency === "today") return "Today";
  if (task.due_at) {
    return `Due ${formatShortDate(task.due_at)}`;
  }
  if (task.scheduled_at) {
    return `Scheduled ${formatShortDate(task.scheduled_at)}`;
  }
  return "Open";
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function sortedActionableTasks(tasks: PersonalTask[]): PersonalTask[] {
  const actionable = tasks.filter(
    (t) => t.status !== "done" && t.sync_state === "active"
  );
  return [...actionable].sort((a, b) => {
    const ua = urgencyOrder(getTaskUrgency(a));
    const ub = urgencyOrder(getTaskUrgency(b));
    if (ua !== ub) return ua - ub;
    const ta = a.due_at ?? a.scheduled_at ?? a.updated_at;
    const tb = b.due_at ?? b.scheduled_at ?? b.updated_at;
    return new Date(ta).getTime() - new Date(tb).getTime();
  });
}

function PersonalBacklogWidget({
  personalSummary,
  personalTasks,
}: {
  personalSummary: any;
  personalTasks: PersonalTask[];
}) {
  const overdue: number = personalSummary.overdue ?? 0;
  const dueToday: number = personalSummary.due_today ?? 0;
  const open: number =
    (personalSummary.in_progress ?? 0) +
    (personalSummary.backlog ?? 0) +
    (personalSummary.blocked ?? 0);
  const delegated: number =
    personalSummary.linked_open ?? personalSummary.delegated ?? 0;

  const actionable = sortedActionableTasks(personalTasks).slice(0, 5);

  let ctaLabel: string;
  let ctaClass: string;
  if (overdue > 0) {
    ctaLabel = `Review ${overdue} Overdue Task${overdue !== 1 ? "s" : ""} →`;
    ctaClass = "border-danger/20 bg-danger/10 text-danger hover:bg-danger/20";
  } else if (dueToday > 0) {
    ctaLabel = `Plan ${dueToday} Task${dueToday !== 1 ? "s" : ""} Due Today →`;
    ctaClass = "border-divider bg-content2/70 text-foreground hover:bg-content2";
  } else {
    ctaLabel = "View Open Backlog →";
    ctaClass = "border-transparent text-foreground-400 hover:bg-content2/70 hover:text-foreground";
  }

  return (
    <Card className="border border-divider bg-content1/50 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
      <CardHeader className="border-b border-divider px-4 py-2.5">
        <div className="flex w-full flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-foreground-400">
            <User size={16} strokeWidth={1.5} className="text-foreground-300" />
            Personal Backlog (Notion)
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {overdue > 0 && (
              <span className="rounded-sm border border-danger/20 bg-danger/10 px-1.5 py-0.5 font-mono text-[11px] text-danger">
                {overdue} overdue
              </span>
            )}
            {dueToday > 0 && (
              <span className="rounded-sm border border-divider bg-content2/70 px-1.5 py-0.5 font-mono text-[11px] text-foreground-400">
                {dueToday} today
              </span>
            )}
            <span className="text-[11px] text-foreground-500 font-mono">{open} open</span>
            {delegated > 0 && (
              <span className="text-[11px] text-foreground-500 font-mono">{delegated} delegated</span>
            )}
            {personalSummary.last_synced_at && (
              <span className="text-[11px] text-foreground-500 font-mono">
                synced {timeAgo(personalSummary.last_synced_at)}
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardBody className="p-3">
        {actionable.length > 0 && (
          <div className="mb-2 mt-1 px-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-foreground-400">
              Priority Actions
            </p>
            <p className="text-[10px] text-foreground-500 font-mono">
              {overdue > 0 ? "Start here: oldest overdue" : dueToday > 0 ? "Start here: due today" : "Start here: next up"}
            </p>
          </div>
        )}

        {actionable.length === 0 ? (
          <div className="rounded-md border border-dashed border-divider px-3 py-4 text-center">
            <p className="text-xs text-foreground-400 font-mono">Inbox zero. Enjoy the silence.</p>
          </div>
        ) : (
          <div>
            {actionable.map((task) => {
              const urgency = getTaskUrgency(task);
              const meta = formatTaskMeta(task, urgency);
              const isOverdue = urgency === "overdue";
              const isToday = urgency === "today";

              const iconColor = isOverdue
                ? "text-danger"
                : isToday
                ? "text-primary"
                : "text-foreground-400";
              const metaColor = isOverdue
                ? "text-danger-400"
                : isToday
                ? "text-primary-400"
                : "text-foreground-400";
              const Icon = isOverdue ? TriangleAlert : isToday ? Clock : Calendar;

              return (
                <div
                  key={task.id}
                  className="group -mx-2 flex items-center justify-between rounded-md px-2 py-2 transition-colors hover:bg-content2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon size={14} strokeWidth={1.5} className={`flex-shrink-0 ${iconColor}`} />
                    <span className="truncate text-[13px] font-medium text-foreground-700 dark:text-foreground-300 group-hover:text-foreground transition-colors">
                      {task.title}
                    </span>
                  </div>
                  <span className={`flex-shrink-0 ml-3 text-[10px] font-mono ${metaColor}`}>
                    {meta}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <a
          href="/tasks?scope=personal"
          className={`mt-4 flex w-full items-center justify-center rounded-md border px-4 py-2.5 text-[12px] font-medium transition-colors ${ctaClass}`}
        >
          {ctaLabel}
        </a>
      </CardBody>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-divider bg-content1/50 px-3 py-2 backdrop-blur shadow-[0_6px_18px_rgba(0,0,0,0.04)] dark:shadow-[0_6px_18px_rgba(0,0,0,0.25)]">
      <p className="text-[10px] uppercase tracking-wider text-foreground-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
