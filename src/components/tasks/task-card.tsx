"use client";

import { Chip } from "@heroui/react";
import { Folder } from "lucide-react";
import type { Task } from "@/lib/api";
import { timeAgo } from "@/lib/dates";
import { resolveAgentAvatarUrl } from "@/lib/agents";
import { StableImage } from "@/components/shared/stable-image";

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

export function TaskCard({ task, onClick }: TaskCardProps) {
  const priority = priorityConfig[task.priority] || priorityConfig[0];
  const assigneeAvatar = resolveAgentAvatarUrl(task.assignee);

  return (
    <button
      onClick={onClick}
      className="w-full rounded border border-divider bg-white dark:bg-[#121212] p-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-[#1A1A1A]"
    >
      <p className="text-sm leading-snug text-foreground">{task.title}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {task.project && (
          <Chip
            size="sm"
            variant="flat"
            className="h-5 border border-divider bg-gray-100 dark:bg-[#1A1A1A] text-[10px] text-foreground-500"
            startContent={<Folder size={10} strokeWidth={1.5} className="mr-0.5" />}
          >
            {task.project.name}
          </Chip>
        )}
        {task.assignee && (
          <span className="text-xs text-foreground-400 capitalize flex items-center gap-1.5">
            {assigneeAvatar ? (
              <StableImage
                src={assigneeAvatar}
                alt={task.assignee}
                width={16}
                height={16}
                fit="cover"
                className="h-4 w-4 shrink-0 rounded-full"
              />
            ) : null}
            {task.assignee}
          </span>
        )}
        {priority.label && (
          <Chip size="sm" variant="flat" color={priority.color} className="text-[10px] h-5">
            {priority.label}
          </Chip>
        )}
        <span className="ml-auto text-[10px] text-foreground-300">
          {timeAgo(task.updated_at || task.created_at)}
        </span>
      </div>
    </button>
  );
}
