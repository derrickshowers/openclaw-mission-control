"use client";

import { useState } from "react";
import { Button, Card, CardBody, CardHeader, Chip } from "@heroui/react";
import { Crosshair, Landmark, Zap, Palette, Bot, Users, ListChecks, ArrowRight, ShieldAlert } from "lucide-react";
import { api } from "@/lib/api";
import type { LucideIcon } from "lucide-react";
import type { Task } from "@/lib/api";
import { timeAgo as timeAgoUtil } from "@/lib/dates";

interface ActivityEntry {
  id: number;
  seq: number;
  event_type: string;
  agent: string | null;
  payload: Record<string, any>;
  created_at: string;
}

interface DashboardContentProps {
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
  frank: "Orchestrator",
  tom: "Lead Architect",
  michael: "Full Stack Engineer",
  joanna: "UX/Product Designer",
};

const agentIcons: Record<string, LucideIcon> = {
  frank: Crosshair,
  tom: Landmark,
  michael: Zap,
  joanna: Palette,
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

export function DashboardContent({ tasks, agents, status, recentActivity }: DashboardContentProps) {
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
    <div className="mx-auto max-w-[1200px] space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Backlog" value={backlog.length} />
        <StatCard label="In Progress" value={inProgress.length} />
        <StatCard label="Blocked" value={blocked.length} />
        <StatCard label="Completed" value={done.length} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Active Agents */}
        <Card className="border border-[#222222] bg-[#121212]">
          <CardHeader className="border-b border-[#222222] px-4 py-3">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Users size={16} strokeWidth={1.5} className="text-muted-foreground" />
              Team
            </span>
          </CardHeader>
          <CardBody className="gap-2 p-3">
            {(agents.length > 0 ? agents : Object.keys(agentRoles).map(name => ({ name }))).map((agent: any) => (
              <div
                key={agent.name}
                className="flex items-center justify-between rounded border border-[#222222] bg-[#080808] px-3 py-2"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1A1A1A] text-muted-foreground">
                    {(() => { const Icon = agentIcons[agent.name] || Bot; return <Icon size={16} strokeWidth={1.5} />; })()}
                  </div>
                  <div>
                    <p className="text-sm font-medium capitalize">{agent.name}</p>
                    <p className="text-xs text-[#888888]">
                      {agentRoles[agent.name] || "Agent"}
                    </p>
                  </div>
                </div>
                <Chip size="sm" variant="flat" color="default" className="text-xs">
                  idle
                </Chip>
              </div>
            ))}
          </CardBody>
        </Card>

        {/* Urgent / In-Progress Tasks */}
        <Card className="border border-[#222222] bg-[#121212]">
          <CardHeader className="border-b border-[#222222] px-4 py-3">
            <span className="flex items-center gap-2 text-sm font-medium">
              <ListChecks size={16} strokeWidth={1.5} className="text-muted-foreground" />
              Active Tasks
            </span>
          </CardHeader>
          <CardBody className="gap-2 p-3">
            {inProgress.length === 0 && blocked.length === 0 ? (
              <p className="py-4 text-center text-sm text-[#888888]">
                No active tasks. Take a breath.
              </p>
            ) : (
              [...blocked, ...inProgress].slice(0, 5).map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between rounded border border-[#222222] bg-[#080808] px-3 py-2"
                >
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm">{task.title}</p>
                    <p className="text-xs text-[#888888]">
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
      </div>

      <Card className="border border-[#222222] bg-[#121212]">
        <CardHeader className="border-b border-[#222222] px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-medium">
            <ShieldAlert size={16} strokeWidth={1.5} className="text-muted-foreground" />
            OpenClaw Controls
          </span>
        </CardHeader>
        <CardBody className="gap-3 p-3">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" color="warning" onPress={handleRestart} isLoading={isRestarting}>
              Restart OpenClaw
            </Button>
            <Button size="sm" variant="flat" onPress={() => handleDoctor(false)} isLoading={doctorRunning}>
              Run Doctor
            </Button>
            <Button size="sm" variant="flat" color="danger" onPress={() => handleDoctor(true)} isLoading={doctorRunning}>
              Run Doctor --fix
            </Button>
          </div>

          <div className="rounded border border-[#222222] bg-[#080808] p-3">
            <p className="text-xs text-[#888888] font-mono mb-2">
              {doctorCommand || "Run doctor to see diagnostics output"}
            </p>
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap font-mono text-xs text-[#CCCCCC]">
              {doctorOutput || "(no output yet)"}
            </pre>
          </div>
        </CardBody>
      </Card>

      {/* Recent Activity */}
      <Card className="border border-[#222222] bg-[#121212]">
        <CardHeader className="border-b border-[#222222] px-4 py-3">
          <div className="flex w-full items-center justify-between">
            <h2 className="text-sm font-medium">Recent Activity</h2>
            <a href="/activity" className="flex items-center gap-1 text-xs text-[#888888] hover:text-white transition-colors">
              View all <ArrowRight size={12} strokeWidth={1.5} />
            </a>
          </div>
        </CardHeader>
        <CardBody className="p-0">
          {recentActivity.length === 0 ? (
            <p className="py-6 text-center font-mono text-xs text-[#555555]">
              No recent activity
            </p>
          ) : (
            <div className="divide-y divide-[#1A1A1A]">
              {recentActivity.slice(0, 5).map((entry, i) => (
                <div
                  key={entry.id || i}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#0A0A0A] transition-colors"
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
                    <span className="flex-shrink-0 text-xs text-[#888888] capitalize w-14 font-mono">
                      {entry.agent}
                    </span>
                  )}
                  <span className="flex-1 truncate font-mono text-xs text-[#CCCCCC]">
                    {formatEventPayload(entry.payload)}
                  </span>
                  <span className="flex-shrink-0 text-[10px] text-[#555555] font-mono">
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
    <div className="rounded border border-[#222222] bg-[#121212] px-4 py-3">
      <p className="text-xs text-[#888888]">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
