"use client";

import { Chip } from "@heroui/react";
import type { Task } from "@/lib/api";
import { timeAgo } from "@/lib/dates";

const priorityConfig: Record<number, { label: string; color: "default" | "warning" | "danger" }> = {
  0: { label: "", color: "default" },
  1: { label: "Low", color: "default" },
  2: { label: "Med", color: "warning" },
  3: { label: "High", color: "danger" },
  4: { label: "Urgent", color: "danger" },
};

interface TaskCardProps {
  task: Task;
  onClick: () => void;
  onStatusChange: (taskId: string, status: string) => void;
}

function avatarUrlFor(agentName?: string | null): string | null {
  if (!agentName) return null;
  if (agentName === "derrick") return "/images/team/derrick.jpg";
  if (!["frank", "tom", "michael", "joanna"].includes(agentName)) return null;
  return `/api/mc/agents/${agentName}/avatar`;
}

export function TaskCard({ task, onClick }: TaskCardProps) {
  const priority = priorityConfig[task.priority] || priorityConfig[0];

  return (
    <button
      onClick={onClick}
      className="w-full rounded border border-[#222222] bg-[#121212] p-3 text-left transition-colors hover:bg-[#1A1A1A]"
    >
      <p className="text-sm leading-snug">{task.title}</p>
      <div className="mt-1.5 flex items-center gap-1.5">
        {task.assignee && (
          <span className="text-xs text-[#888888] capitalize flex items-center gap-1.5">
            {avatarUrlFor(task.assignee) ? (
              <img src={avatarUrlFor(task.assignee)!} alt={task.assignee} className="h-4 w-4 rounded-full object-cover" />
            ) : null}
            {task.assignee}
          </span>
        )}
        {priority.label && (
          <Chip size="sm" variant="flat" color={priority.color} className="text-[10px] h-5">
            {priority.label}
          </Chip>
        )}
        {task.tags && (
          <>
            {JSON.parse(task.tags).map((tag: string) => (
              <Chip key={tag} size="sm" variant="flat" className="text-[10px] h-5">
                {tag}
              </Chip>
            ))}
          </>
        )}
        <span className="ml-auto text-[10px] text-[#555555]">
          {timeAgo(task.updated_at || task.created_at)}
        </span>
      </div>
    </button>
  );
}
