"use client";

import { Chip } from "@heroui/react";
import type { Task } from "@/lib/api";

const priorityConfig: Record<number, { label: string; color: "default" | "warning" | "danger" }> = {
  0: { label: "", color: "default" },
  1: { label: "Low", color: "default" },
  2: { label: "Med", color: "warning" },
  3: { label: "High", color: "danger" },
  4: { label: "Urgent", color: "danger" },
};

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr + (dateStr.includes("Z") ? "" : "Z")).getTime();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface TaskCardProps {
  task: Task;
  onClick: () => void;
  onStatusChange: (taskId: string, status: string) => void;
}

export function TaskCard({ task, onClick }: TaskCardProps) {
  const priority = priorityConfig[task.priority] || priorityConfig[0];

  return (
    <button
      onClick={onClick}
      className="w-full rounded border border-[#222222] bg-[#121212] p-3 text-left transition-colors hover:bg-[#1A1A1A]"
    >
      <p className="text-sm leading-snug">{task.title}</p>
      <div className="mt-2 flex items-center gap-2">
        {task.assignee && (
          <span className="text-xs text-[#888888] capitalize">
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
          {formatRelativeTime(task.updated_at || task.created_at)}
        </span>
      </div>
    </button>
  );
}
