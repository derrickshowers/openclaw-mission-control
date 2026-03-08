"use client";

import { Card, CardBody, CardHeader, Chip } from "@heroui/react";
import type { Task } from "@/lib/api";

interface DashboardContentProps {
  tasks: Task[];
  agents: any[];
  status: any;
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

export function DashboardContent({ tasks, agents, status }: DashboardContentProps) {
  const inProgress = tasks.filter((t) => t.status === "in_progress");
  const blocked = tasks.filter((t) => t.status === "blocked");
  const done = tasks.filter((t) => t.status === "done");
  const backlog = tasks.filter((t) => t.status === "backlog");

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
            <h2 className="text-sm font-medium">Team</h2>
          </CardHeader>
          <CardBody className="gap-2 p-3">
            {(agents.length > 0 ? agents : Object.keys(agentRoles).map(name => ({ name }))).map((agent: any) => (
              <div
                key={agent.name}
                className="flex items-center justify-between rounded border border-[#222222] bg-[#080808] px-3 py-2"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1A1A1A] text-xs">
                    {agent.identity?.emoji || agent.name[0].toUpperCase()}
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
            <h2 className="text-sm font-medium">Active Tasks</h2>
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
