"use client";

import { useState } from "react";
import { Button, Input, Textarea, Select, SelectItem, Chip } from "@heroui/react";
import { X, Trash2 } from "lucide-react";
import type { Task } from "@/lib/api";

const COLUMNS = [
  { id: "backlog", label: "Backlog" },
  { id: "in_progress", label: "In Progress" },
  { id: "blocked", label: "Blocked" },
  { id: "done", label: "Done" },
];

const AGENTS = ["frank", "tom", "michael", "joanna"];

const statusColors: Record<string, "default" | "primary" | "danger" | "success"> = {
  backlog: "default",
  in_progress: "primary",
  blocked: "danger",
  done: "success",
};

interface TaskDrawerProps {
  task: Task;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (task: Task) => void;
}

export function TaskDrawer({ task, isOpen, onClose, onUpdate }: TaskDrawerProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || "");

  if (!isOpen) return null;

  const saveEdits = async () => {
    try {
      const res = await fetch(`/api/mc/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description }),
      });
      const updated = await res.json();
      onUpdate(updated);
      setEditing(false);
    } catch (err) {
      console.error("Failed to save:", err);
    }
  };

  const updateField = async (field: string, value: any) => {
    try {
      const res = await fetch(`/api/mc/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      const updated = await res.json();
      onUpdate(updated);
    } catch (err) {
      console.error("Failed to update:", err);
    }
  };

  const deleteTask = async () => {
    try {
      await fetch(`/api/mc/tasks/${task.id}`, { method: "DELETE" });
      onClose();
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 z-50 h-full w-full max-w-md overflow-y-auto border-l border-[#222222] bg-[#0A0A0A]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#222222] px-4 py-3">
          <div className="flex items-center gap-2">
            <Chip size="sm" variant="flat" color={statusColors[task.status]}>
              {task.status.replace("_", " ")}
            </Chip>
            <span className="text-xs text-[#888888] font-mono">{task.id.slice(0, 8)}</span>
          </div>
          <button onClick={onClose} className="text-[#888888] hover:text-white">
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {editing ? (
            <>
              <Input
                value={title}
                onValueChange={setTitle}
                variant="bordered"
                size="sm"
                classNames={{ inputWrapper: "border-[#222222] bg-[#080808]" }}
              />
              <Textarea
                value={description}
                onValueChange={setDescription}
                variant="bordered"
                size="sm"
                minRows={3}
                classNames={{ inputWrapper: "border-[#222222] bg-[#080808]" }}
              />
              <div className="flex gap-2">
                <Button size="sm" color="primary" onPress={saveEdits}>Save</Button>
                <Button size="sm" variant="flat" onPress={() => setEditing(false)}>Cancel</Button>
              </div>
            </>
          ) : (
            <>
              <div>
                <h2
                  className="text-lg font-medium cursor-pointer hover:text-[#888888]"
                  onClick={() => setEditing(true)}
                >
                  {task.title}
                </h2>
                {task.description && (
                  <p className="mt-2 text-sm text-[#888888] whitespace-pre-wrap">
                    {task.description}
                  </p>
                )}
                {!task.description && (
                  <p
                    className="mt-2 text-sm text-[#555555] cursor-pointer hover:text-[#888888]"
                    onClick={() => setEditing(true)}
                  >
                    Add description...
                  </p>
                )}
              </div>
            </>
          )}

          {/* Fields */}
          <div className="space-y-3 border-t border-[#222222] pt-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#888888]">Status</span>
              <Select
                selectedKeys={[task.status]}
                onSelectionChange={(keys) => {
                  const v = Array.from(keys)[0] as string;
                  if (v) updateField("status", v);
                }}
                variant="bordered"
                size="sm"
                className="max-w-[160px]"
                classNames={{ trigger: "border-[#222222] bg-[#080808] h-8 min-h-8" }}
              >
                {COLUMNS.map((c) => (
                  <SelectItem key={c.id}>{c.label}</SelectItem>
                ))}
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-[#888888]">Assignee</span>
              <Select
                selectedKeys={task.assignee ? [task.assignee] : []}
                onSelectionChange={(keys) => {
                  const v = Array.from(keys)[0] as string;
                  updateField("assignee", v || null);
                }}
                variant="bordered"
                size="sm"
                placeholder="Unassigned"
                className="max-w-[160px]"
                classNames={{ trigger: "border-[#222222] bg-[#080808] h-8 min-h-8" }}
              >
                {AGENTS.map((a) => (
                  <SelectItem key={a} className="capitalize">{a}</SelectItem>
                ))}
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-[#888888]">Priority</span>
              <Select
                selectedKeys={[String(task.priority)]}
                onSelectionChange={(keys) => {
                  const v = Array.from(keys)[0] as string;
                  if (v !== undefined) updateField("priority", parseInt(v));
                }}
                variant="bordered"
                size="sm"
                className="max-w-[160px]"
                classNames={{ trigger: "border-[#222222] bg-[#080808] h-8 min-h-8" }}
              >
                {[
                  { value: "0", label: "None" },
                  { value: "1", label: "Low" },
                  { value: "2", label: "Medium" },
                  { value: "3", label: "High" },
                  { value: "4", label: "Urgent" },
                ].map((p) => (
                  <SelectItem key={p.value}>{p.label}</SelectItem>
                ))}
              </Select>
            </div>
          </div>

          {/* Metadata */}
          <div className="space-y-2 border-t border-[#222222] pt-4 text-xs text-[#555555]">
            <p>Created: {new Date(task.created_at).toLocaleString()}</p>
            <p>Updated: {new Date(task.updated_at).toLocaleString()}</p>
            <p>Created by: {task.created_by}</p>
          </div>

          {/* Delete */}
          <div className="border-t border-[#222222] pt-4">
            <Button
              size="sm"
              variant="flat"
              color="danger"
              onPress={deleteTask}
              startContent={<Trash2 size={14} strokeWidth={1.5} />}
            >
              Delete Task
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
