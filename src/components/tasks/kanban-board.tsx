"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useSSE } from "@/hooks/use-sse";
import { Button, Input, Textarea, Select, SelectItem, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Chip, useDisclosure } from "@heroui/react";
import { Plus, Paperclip, ImagePlus, X, Folder } from "lucide-react";
import { api, type Task, type Project } from "@/lib/api";
import { parseUTC } from "@/lib/dates";
import { KNOWN_AGENT_IDS } from "@/lib/agents";
import { TaskCard } from "./task-card";
import { TaskDrawer } from "./task-drawer";
import { StableImage } from "@/components/shared/stable-image";

import { useRouter, useSearchParams } from "next/navigation";

const COLUMNS = [
  { id: "backlog", label: "Backlog", color: "#888888" },
  { id: "in_progress", label: "In Progress", color: "#8b5cf6" },
  { id: "blocked", label: "Blocked", color: "#ef4444" },
  { id: "done", label: "Done", color: "#22c55e" },
] as const;

const AGENTS = [...KNOWN_AGENT_IDS];
const PRIORITIES = [
  { value: "0", label: "None" },
  { value: "1", label: "Low" },
  { value: "2", label: "Medium" },
  { value: "3", label: "High" },
  { value: "4", label: "Urgent" },
];

interface KanbanBoardProps {
  initialTasks: Task[];
  initialProjectId?: string | null;
  projects?: Project[];
}

export function KanbanBoard({ initialTasks, initialProjectId, projects: initialProjects }: KanbanBoardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [projects, setProjects] = useState<Project[]>(initialProjects || []);
  const [projectId, setProjectId] = useState<string | null>(initialProjectId || null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { isOpen, onOpen, onClose } = useDisclosure();

  // Handle opening task from URL
  useEffect(() => {
    const taskId = searchParams.get("task");
    if (taskId) {
      const task = tasks.find((t) => t.id === taskId);
      if (task) {
        setSelectedTask(task);
        setDrawerOpen(true);
      } else {
        // Fetch if not in list (e.g. archived or different project)
        api.getTask(taskId).then((t) => {
          setSelectedTask(t);
          setDrawerOpen(true);
        }).catch(() => {
          // Clear param if not found
          const params = new URLSearchParams(searchParams.toString());
          params.delete("task");
          router.replace(`/tasks?${params.toString()}`);
        });
      }
    }
  }, [searchParams, tasks, router]);

  const closeTaskDrawer = useCallback(() => {
    setDrawerOpen(false);
    // Clear param from URL
    const params = new URLSearchParams(searchParams.toString());
    params.delete("task");
    router.replace(`/tasks?${params.toString()}`);
  }, [router, searchParams]);

  // New task form state
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newAssignee, setNewAssignee] = useState("");
  const [newProject, setNewProject] = useState(projectId || "");
  const [newPriority, setNewPriority] = useState("0");
  const [newStatus, setNewStatus] = useState("backlog");

  useEffect(() => {
    api.getProjects().then(setProjects).catch(console.error);
  }, []);

  useEffect(() => {
    setNewProject(projectId || "");
    api.getTasks({ project_id: projectId || undefined }).then(setTasks).catch(console.error);
  }, [projectId]);
  const [pendingAttachments, setPendingAttachments] = useState<File[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const allowed = ["image/png", "image/jpeg", "image/gif", "image/webp"];
    const errors: string[] = [];

    const validFiles = files.filter((file) => {
      if (!allowed.includes(file.type)) {
        errors.push(`${file.name} is not a supported image type.`);
        return false;
      }
      if (file.size > 5 * 1024 * 1024) {
        errors.push(`${file.name} is too large (max 5MB).`);
        return false;
      }
      return true;
    });

    setPendingAttachments((prev) => [...prev, ...validFiles].slice(0, 10));

    if (errors.length > 0) {
      setAttachmentError(errors.join("\n"));
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removePendingAttachment = (index: number) => {
    setPendingAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const createTask = useCallback(async () => {
    if (!newTitle.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const task = await api.createTask({
        title: newTitle,
        description: newDescription || undefined,
        assignee: newAssignee || undefined,
        project_id: newProject || undefined,
        priority: parseInt(newPriority),
        status: newStatus,
      });

      // Upload attachments if any
      if (pendingAttachments.length > 0) {
        await Promise.all(
          pendingAttachments.map(file => api.uploadAttachment(task.id, file, "derrick"))
        );
      }

      setTasks((prev) => {
        if (prev.some((t) => t.id === task.id)) return prev;
        return [...prev, task];
      });
      setNewTitle("");
      setNewDescription("");
      setNewAssignee("");
      setNewProject("");
      setNewPriority("0");
      setNewStatus("backlog");
      setPendingAttachments([]);
      onClose();
    } catch (err) {
      console.error("Failed to create task:", err);
    } finally {
      setIsSubmitting(false);
    }
  }, [newTitle, newDescription, newAssignee, newProject, newPriority, newStatus, pendingAttachments, isSubmitting, onClose]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't trigger when typing in any editable element
      const el = e.target as HTMLElement;
      const tag = el.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (el.isContentEditable || el.closest("[contenteditable]")) return;
      if (el.closest("[role='textbox']")) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "c" || e.key === "n") {
        e.preventDefault();
        onOpen();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onOpen]);

  // Live task updates via SSE
  const taskEvents = ["task.created", "task.updated", "task.deleted", "task.moved"];
  const { lastEvent } = useSSE(taskEvents);

  useEffect(() => {
    if (!lastEvent) return;
    const { event, data } = lastEvent;

    const matchesActiveProject = (task: Task) => !projectId || task.project_id === projectId;

    switch (event) {
      case "task.created":
      case "task.updated":
      case "task.moved":
        if (data.task) {
          setTasks((prev) => {
            const idx = prev.findIndex((t) => t.id === data.task.id);
            const includeTask = matchesActiveProject(data.task as Task);

            if (idx === -1) {
              return includeTask ? [...prev, data.task] : prev;
            }

            if (!includeTask) {
              return prev.filter((t) => t.id !== data.task.id);
            }

            return prev.map((t) => {
              if (t.id !== data.task.id) return t;
              // Skip if our local version is same or newer
              if (t.updated_at >= data.task.updated_at) return t;
              return data.task;
            });
          });
        }
        break;
      case "task.deleted":
        if (data.id) {
          setTasks((prev) => prev.filter((t) => t.id !== data.id));
        }
        break;
    }
  }, [lastEvent, projectId]);

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
          <span className="text-sm text-foreground-400">{tasks.length} tasks</span>
          {projectId && (
            <Chip
              size="sm"
              variant="flat"
              onClose={() => setProjectId(null)}
              className="h-6 border border-divider bg-gray-100 dark:bg-[#1A1A1A] text-[10px] text-foreground-500 dark:text-[#CCCCCC]"
            >
              Project: {projects.find((p) => p.id === projectId)?.name || "Loading..."}
            </Chip>
          )}
        </div>
        <Button
          size="sm"
          variant="flat"
          onPress={onOpen}
          className="border border-divider bg-white dark:bg-[#121212] text-sm text-foreground"
          startContent={<Plus size={16} strokeWidth={1.5} />}
        >
          New Task
        </Button>
      </div>

      {/* Kanban Columns */}
      <div className="flex flex-1 gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((column) => {
          const columnTasks = tasks
            .filter((t) => t.status === column.id)
            .sort((a, b) => {
              // Most recently updated first
              const aTime = parseUTC(a.updated_at || a.created_at).getTime();
              const bTime = parseUTC(b.updated_at || b.created_at).getTime();
              return bTime - aTime;
            });

          return (
            <div
              key={column.id}
              className="flex w-72 flex-shrink-0 flex-col rounded border border-divider bg-gray-50/50 dark:bg-[#0A0A0A]"
            >
              {/* Column Header */}
              <div className="flex items-center gap-2 border-b border-divider px-3 py-2">
                <div
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: column.color }}
                />
                <span className="text-[10px] font-medium uppercase tracking-wider text-foreground-400">{column.label}</span>
                <span className="ml-auto text-xs text-foreground-400">
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
                  <p className="py-6 text-center text-xs text-foreground-300">
                    No tasks
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Task Modal */}
      <Modal 
        isOpen={isOpen} 
        onClose={onClose} 
        className="bg-white dark:bg-[#121212] text-foreground dark:text-white max-h-[85dvh]"
        placement="top-center"
        scrollBehavior="inside"
        backdrop="opaque"
        classNames={{
          backdrop: "bg-black/20 dark:bg-black/60"
        }}
      >
        <ModalContent>
          <ModalHeader className="border-b border-divider text-sm">
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
              classNames={{ inputWrapper: "border-divider bg-white dark:bg-[#080808]" }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.shiftKey && newTitle.trim()) {
                  e.preventDefault();
                  createTask();
                }
              }}
              autoFocus
            />
            <Select
              label="Project"
              placeholder="No project"
              selectedKeys={newProject ? [newProject] : []}
              onSelectionChange={(keys) => setNewProject(Array.from(keys)[0] as string || "")}
              variant="bordered"
              size="sm"
              classNames={{ trigger: "border-divider bg-white dark:bg-[#080808]" }}
              startContent={<Folder size={14} strokeWidth={1.5} className="text-foreground-400" />}
            >
              {projects.map((p) => (
                <SelectItem key={p.id}>{p.name}</SelectItem>
              ))}
            </Select>
            <Textarea
              label="Description"
              placeholder="Optional details..."
              value={newDescription}
              onValueChange={setNewDescription}
              variant="bordered"
              size="sm"
              classNames={{ inputWrapper: "border-divider bg-white dark:bg-[#080808]" }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.shiftKey && newTitle.trim()) {
                  e.preventDefault();
                  createTask();
                }
              }}
            />
            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Assignee"
                placeholder="Unassigned"
                selectedKeys={newAssignee ? [newAssignee] : []}
                onSelectionChange={(keys) => setNewAssignee(Array.from(keys)[0] as string || "")}
                variant="bordered"
                size="sm"
                classNames={{ trigger: "border-divider bg-white dark:bg-[#080808] capitalize" }}
              >
                {AGENTS.map((a) => (
                  <SelectItem key={a} className="capitalize">{a}</SelectItem>
                ))}
              </Select>
              <Select
                label="Priority"
                selectedKeys={[newPriority]}
                onSelectionChange={(keys) => setNewPriority(Array.from(keys)[0] as string || "0")}
                variant="bordered"
                size="sm"
                classNames={{ trigger: "border-divider bg-white dark:bg-[#080808]" }}
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
              classNames={{ trigger: "border-divider bg-white dark:bg-[#080808]" }}
            >
              {COLUMNS.map((c) => (
                <SelectItem key={c.id}>{c.label}</SelectItem>
              ))}
            </Select>

            {/* Attachments UI */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium text-foreground-400 uppercase tracking-wider flex items-center gap-1">
                  <Paperclip size={10} strokeWidth={1.5} />
                  Attachments
                  {pendingAttachments.length > 0 && (
                    <span className="text-foreground-300">({pendingAttachments.length}/10)</span>
                  )}
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/png,image/jpeg,image/gif,image/webp"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <Button
                  size="sm"
                  variant="flat"
                  onPress={() => fileInputRef.current?.click()}
                  startContent={<ImagePlus size={14} strokeWidth={1.5} />}
                  className="h-7 text-xs bg-white dark:bg-[#080808] border border-divider"
                >
                  Attach
                </Button>
              </div>

              {pendingAttachments.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {pendingAttachments.map((file, i) => (
                    <div
                      key={i}
                      className="group relative h-12 w-12 rounded border border-divider bg-gray-50 dark:bg-[#0A0A0A] overflow-hidden"
                    >
                      <StableImage
                        src={URL.createObjectURL(file)}
                        alt={file.name}
                        width={48}
                        height={48}
                        fit="cover"
                        className="h-full w-full"
                      />
                      <button
                        className="absolute top-0 right-0 p-0.5 bg-black/60 text-white hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removePendingAttachment(i)}
                      >
                        <X size={10} strokeWidth={2} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ModalBody>
          <ModalFooter className="border-t border-divider flex items-center">
            <span className="text-[10px] text-foreground-300 mr-auto">⇧ Enter to submit</span>
            <Button variant="flat" onPress={onClose} size="sm">
              Cancel
            </Button>
            <Button
              color="primary"
              onPress={createTask}
              size="sm"
              isLoading={isSubmitting}
              isDisabled={!newTitle.trim()}
            >
              Create
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal
        isOpen={!!attachmentError}
        onClose={() => setAttachmentError(null)}
        className="bg-white dark:bg-[#121212] text-foreground dark:text-white"
        backdrop="opaque"
        classNames={{
          backdrop: "bg-black/20 dark:bg-black/60"
        }}
      >
        <ModalContent>
          <ModalHeader className="border-b border-divider text-sm">Attachment validation</ModalHeader>
          <ModalBody className="py-4">
            <p className="whitespace-pre-line text-sm text-foreground-500 dark:text-[#CCCCCC]">{attachmentError}</p>
          </ModalBody>
          <ModalFooter className="border-t border-divider">
            <Button size="sm" color="primary" onPress={() => setAttachmentError(null)}>
              OK
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Task Drawer */}
      {selectedTask && (
        <TaskDrawer
          task={selectedTask}
          isOpen={drawerOpen}
          onClose={closeTaskDrawer}
          onUpdate={(updated) => {
            setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
            setSelectedTask(updated);
          }}
        />
      )}
    </div>
  );
}
