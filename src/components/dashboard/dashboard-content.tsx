"use client";

import { useState } from "react";
import { Button, Card, CardBody, CardHeader, Chip } from "@heroui/react";
import { Crown, Crosshair, Landmark, Zap, Palette, Bot, Users, ListChecks, ArrowRight, ShieldAlert, User } from "lucide-react";
import { api } from "@/lib/api";
import type { LucideIcon } from "lucide-react";
import type { Task } from "@/lib/api";
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

export function DashboardContent({ tasks, agents, status, recentActivity, personalSummary }: DashboardContentProps) {
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
        <Card className="border border-divider bg-content1/50 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.15)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
          <CardHeader className="border-b border-divider px-4 py-2.5">
            <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-foreground-400">
              <Users size={16} strokeWidth={1.5} className="text-muted-foreground" />
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
                className="flex items-center justify-between rounded-lg border border-divider bg-content2/50 px-3 py-2 backdrop-blur"
              >
                <div className="flex items-center gap-3">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={agent.name}
                      className="h-7 w-7 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-default-100 text-muted-foreground">
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
        <Card className="border border-divider bg-content1/50 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.15)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
          <CardHeader className="border-b border-divider px-4 py-2.5">
            <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-foreground-400">
              <ListChecks size={16} strokeWidth={1.5} className="text-muted-foreground" />
              Active Tasks
            </span>
          </CardHeader>
          <CardBody className="gap-2 p-3">
            {inProgress.length === 0 && blocked.length === 0 ? (
              <p className="py-4 text-center text-sm text-foreground-400">
                No active tasks. Take a breath.
              </p>
            ) : (
              [...blocked, ...inProgress].slice(0, 5).map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between rounded-lg border border-divider bg-content2/50 px-3 py-2 backdrop-blur"
                >
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm">{task.title}</p>
                    <p className="text-xs text-foreground-400 flex items-center gap-1.5">
                      {task.assignee && resolveAgentAvatarUrl(task.assignee) ? (
                        <img src={resolveAgentAvatarUrl(task.assignee)!} alt={task.assignee} className="h-4 w-4 rounded-full object-cover" />
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
                        className="text-xs"
                      >
                        {priorityLabels[task.priority]?.label}
                      </Chip>
                    )}
                    <Chip
                      size="sm"
                      variant="flat"
                      color={task.status === "blocked" ? "danger" : "primary"}
                      className="text-xs"
                    >
                      {task.status === "in_progress" ? "active" : task.status}
                    </Chip>
                  </div>
                </div>
              ))
            )}
          </CardBody>
        </Card>
      {/* Personal Summary Widget */}
      {personalSummary && (
        <Card className="border border-divider bg-content1/50 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.15)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
          <CardHeader className="border-b border-divider px-4 py-2.5">
            <div className="flex w-full items-center justify-between">
              <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-foreground-400">
                <User size={16} strokeWidth={1.5} className="text-muted-foreground" />
                Personal Backlog (Notion)
              </span>
              {personalSummary.last_synced_at && (
                <span className="text-[10px] text-foreground-500 font-mono">
                  Synced {timeAgo(personalSummary.last_synced_at)}
                </span>
              )}
            </div>
          </CardHeader>
          <CardBody className="p-3">
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="rounded-lg bg-content2/50 p-2 text-center">
                <p className="text-[10px] uppercase text-foreground-400">Overdue</p>
                <p className={`text-lg font-bold ${personalSummary.overdue > 0 ? 'text-danger' : 'text-foreground'}`}>
                  {personalSummary.overdue}
                </p>
              </div>
              <div className="rounded-lg bg-content2/50 p-2 text-center">
                <p className="text-[10px] uppercase text-foreground-400">Today</p>
                <p className="text-lg font-bold text-primary">{personalSummary.due_today}</p>
              </div>
              <div className="rounded-lg bg-content2/50 p-2 text-center">
                <p className="text-[10px] uppercase text-foreground-400">Open</p>
                <p className="text-lg font-bold">{personalSummary.in_progress + personalSummary.backlog + personalSummary.blocked}</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs px-1">
                <span className="text-foreground-400">Delegated items</span>
                <span className="font-medium text-primary">{personalSummary.linked_open ?? personalSummary.delegated ?? 0} active</span>
              </div>
              <Button 
                as="a" 
                href="/tasks?scope=personal" 
                variant="flat" 
                size="sm" 
                fullWidth 
                className="mt-2 text-xs"
                endContent={<ArrowRight size={14} />}
              >
                View Personal Tasks
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      </div>

      <Card className="border border-divider bg-content1/50 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.15)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
        <CardHeader className="border-b border-divider px-4 py-2.5">
          <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-foreground-400">
            <ShieldAlert size={16} strokeWidth={1.5} className="text-muted-foreground" />
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
            <p className="text-xs text-foreground-400 font-mono mb-2">
              {doctorCommand || "Run doctor to see diagnostics output"}
            </p>
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap font-mono text-xs text-foreground-500">
              {doctorOutput || "(no output yet)"}
            </pre>
          </div>
        </CardBody>
      </Card>

      {/* Recent Activity */}
      <Card className="border border-divider bg-content1/50 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.15)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
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
            <p className="py-6 text-center font-mono text-xs text-foreground-500">
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
                  <span className="flex-shrink-0 text-[10px] text-foreground-500 font-mono">
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

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-divider bg-content1/50 px-3 py-2 backdrop-blur shadow-[0_6px_18px_rgba(0,0,0,0.1)] dark:shadow-[0_6px_18px_rgba(0,0,0,0.25)]">
      <p className="text-[10px] uppercase tracking-wider text-foreground-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
