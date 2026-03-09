"use client";

import { useState, useCallback } from "react";
import { Button, Input, Textarea, Select, SelectItem, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure } from "@heroui/react";
import type { Task } from "@/lib/api";
import { TaskCard } from "./task-card";
import { TaskDrawer } from "./task-drawer";

const COLUMNS = [
  { id: "backlog", label: "Backlog", color: "#888888" },
  { id: "in_progress", label: "In Progress", color: "#8b5cf6" },
  { id: "blocked", label: "Blocked", color: "#ef4444" },
  { id: "done", label: "Done", color: "#22c55e" },
] as const;

const AGENTS = ["derrick", "frank", "tom", "michael", "joanna"];
const PRIORITIES = [
  { value: "0", label: "None" },
  { value: "1", label: "Low" },
  { value: "2", label: "Medium" },
  { value: "3", label: "High" },
  { value: "4", label: "Urgent" },
];

interface KanbanBoardProps {
  initialTasks: Task[];
}

export function KanbanBoard({ initialTasks }: KanbanBoardProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { isOpen, onOpen, onClose } = useDisclosure();

  // New task form state
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newAssignee, setNewAssignee] = useState("");
  const [newPriority, setNewPriority] = useState("0");
  const [newStatus, setNewStatus] = useState("backlog");

  const createTask = useCallback(async () => {
    if (!newTitle.trim()) return;

    try {
      const res = await fetch("/api/mc/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          description: newDescription || undefined,
          assignee: newAssignee || undefined,
          priority: parseInt(newPriority),
          status: newStatus,
        }),
      });
      const task = await res.json();
      setTasks((prev) => [...prev, task]);
      setNewTitle("");
      setNewDescription("");
      setNewAssignee("");
      setNewPriority("0");
      setNewStatus("backlog");
      onClose();
    } catch (err) {
      console.error("Failed to create task:", err);
    }
  }, [newTitle, newDescription, newAssignee, newPriority, newStatus, onClose]);

  const updateTaskStatus = useCallback(async (taskId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/mc/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const updated = await res.json();
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
    } catch (err) {
      console.error("Failed to update task:", err);
    }
  }, []);

  const openTaskDrawer = useCallback((task: Task) => {
    setSelectedTask(task);
    setDrawerOpen(true);
  }, []);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm text-[#888888]">{tasks.length} tasks</span>
        </div>
        <Button
          size="sm"
          variant="flat"
          onPress={onOpen}
          className="border border-[#222222] bg-[#121212] text-sm"
        >
          + New Task
        </Button>
      </div>

      {/* Kanban Columns */}
      <div className="flex flex-1 gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((column) => {
          const columnTasks = tasks
            .filter((t) => t.status === column.id)
            .sort((a, b) => a.position - b.position);

          return (
            <div
              key={column.id}
              className="flex w-72 flex-shrink-0 flex-col rounded border border-[#222222] bg-[#0A0A0A]"
            >
              {/* Column Header */}
              <div className="flex items-center gap-2 border-b border-[#222222] px-3 py-2.5">
                <div
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: column.color }}
                />
                <span className="text-xs font-medium">{column.label}</span>
                <span className="ml-auto text-xs text-[#888888]">
                  {columnTasks.length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex-1 space-y-2 overflow-y-auto p-2">
                {columnTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onClick={() => openTaskDrawer(task)}
                    onStatusChange={updateTaskStatus}
                  />
                ))}
                {columnTasks.length === 0 && (
                  <p className="py-6 text-center text-xs text-[#555555]">
                    No tasks
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Task Modal */}
      <Modal isOpen={isOpen} onClose={onClose} className="dark bg-[#121212] text-white">
        <ModalContent>
          <ModalHeader className="border-b border-[#222222] text-sm">
            New Task
          </ModalHeader>
          <ModalBody className="gap-3 py-4">
            <Input
              label="Title"
              placeholder="What needs to be done?"
              value={newTitle}
              onValueChange={setNewTitle}
              variant="bordered"
              size="sm"
              classNames={{ inputWrapper: "border-[#222222] bg-[#080808]" }}
            />
            <Textarea
              label="Description"
              placeholder="Optional details..."
              value={newDescription}
              onValueChange={setNewDescription}
              variant="bordered"
              size="sm"
              classNames={{ inputWrapper: "border-[#222222] bg-[#080808]" }}
            />
            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Assignee"
                placeholder="Unassigned"
                selectedKeys={newAssignee ? [newAssignee] : []}
                onSelectionChange={(keys) => setNewAssignee(Array.from(keys)[0] as string || "")}
                variant="bordered"
                size="sm"
                classNames={{ trigger: "border-[#222222] bg-[#080808]" }}
              >
                {AGENTS.map((a) => (
                  <SelectItem key={a}>{a}</SelectItem>
                ))}
              </Select>
              <Select
                label="Priority"
                selectedKeys={[newPriority]}
                onSelectionChange={(keys) => setNewPriority(Array.from(keys)[0] as string || "0")}
                variant="bordered"
                size="sm"
                classNames={{ trigger: "border-[#222222] bg-[#080808]" }}
              >
                {PRIORITIES.map((p) => (
                  <SelectItem key={p.value}>{p.label}</SelectItem>
                ))}
              </Select>
            </div>
            <Select
              label="Status"
              selectedKeys={[newStatus]}
              onSelectionChange={(keys) => setNewStatus(Array.from(keys)[0] as string || "backlog")}
              variant="bordered"
              size="sm"
              classNames={{ trigger: "border-[#222222] bg-[#080808]" }}
            >
              {COLUMNS.map((c) => (
                <SelectItem key={c.id}>{c.label}</SelectItem>
              ))}
            </Select>
          </ModalBody>
          <ModalFooter className="border-t border-[#222222]">
            <Button variant="flat" onPress={onClose} size="sm">
              Cancel
            </Button>
            <Button
              color="primary"
              onPress={createTask}
              size="sm"
              isDisabled={!newTitle.trim()}
            >
              Create
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Task Drawer */}
      {selectedTask && (
        <TaskDrawer
          task={selectedTask}
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          onUpdate={(updated) => {
            setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
            setSelectedTask(updated);
          }}
        />
      )}
    </div>
  );
}
