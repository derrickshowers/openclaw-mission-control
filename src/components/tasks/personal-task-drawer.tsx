"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  Button,
  Chip,
  Card,
  CardBody,
  Spinner,
  Select,
  SelectItem,
  Input,
  Textarea,
  DatePicker,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Checkbox,
  useDisclosure,
} from "@heroui/react";
import {
  X,
  ExternalLink,
  ArrowUpCircle,
  Bot,
  User,
  Folder,
  ArrowUpRight,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { parseDate, type DateValue } from "@internationalized/date";
import { api, type PersonalTaskDetail, type Project } from "@/lib/api";
import { timeAgo } from "@/lib/dates";
import { KNOWN_AGENT_IDS } from "@/lib/agents";

interface PersonalTaskDrawerProps {
  taskId: string;
  isOpen: boolean;
  onClose: () => void;
  onPromoted?: () => void;
  onTaskUpdated?: () => void;
}

const AGENTS = [...KNOWN_AGENT_IDS];
const PRIORITIES = [
  { value: "0", label: "None" },
  { value: "1", label: "Low" },
  { value: "2", label: "Medium" },
  { value: "3", label: "High" },
  { value: "4", label: "Urgent" },
];

const FALLBACK_STATUS_OPTIONS = [
  { source: "To Do", canonical: "backlog" as const },
  { source: "To Do (Someday)", canonical: "backlog" as const },
  { source: "In Progress", canonical: "in_progress" as const },
  { source: "Blocked", canonical: "blocked" as const },
  { source: "Done", canonical: "done" as const },
];

type NotionPropertyOption = {
  name?: string | null;
};

type NotionProperty = {
  type?: string;
  status?: {
    name?: string | null;
    options?: NotionPropertyOption[] | null;
  } | null;
  select?: {
    name?: string | null;
    options?: NotionPropertyOption[] | null;
  } | null;
};

function normalizeSourceStatus(sourceStatus: string | null | undefined) {
  const normalized = (sourceStatus || "").trim().toLowerCase();
  if (!normalized) return "backlog" as const;

  if (normalized === "to do (someday)" || normalized === "to do" || normalized === "todo") {
    return "backlog" as const;
  }
  if (normalized === "in progress" || normalized === "in_progress") {
    return "in_progress" as const;
  }
  if (normalized === "done") {
    return "done" as const;
  }

  if (
    normalized.includes("done") ||
    normalized.includes("complete") ||
    normalized.includes("closed") ||
    normalized === "✅"
  ) {
    return "done" as const;
  }

  if (normalized.includes("block") || normalized.includes("wait") || normalized.includes("hold")) {
    return "blocked" as const;
  }

  if (
    normalized.includes("progress") ||
    normalized.includes("doing") ||
    normalized.includes("today") ||
    normalized.includes("active")
  ) {
    return "in_progress" as const;
  }

  return "backlog" as const;
}

function toCalendarDateValue(iso: string | null | undefined): DateValue | null {
  if (!iso) return null;
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return null;
  const dateString = new Date(parsed).toISOString().slice(0, 10);
  return parseDate(dateString);
}

function toIsoDateFromCalendar(value: DateValue | null): string | null {
  if (!value) return null;
  return value.toString();
}

function dedupeStatusOptions(sources: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const options: Array<{ source: string; canonical: ReturnType<typeof normalizeSourceStatus> }> = [];

  for (const rawSource of sources) {
    const source = String(rawSource || "").trim();
    if (!source) continue;

    const key = source.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    options.push({ source, canonical: normalizeSourceStatus(source) });
  }

  return options;
}

function extractCurrentSourceStatus(task: PersonalTaskDetail | null) {
  if (!task) return "";
  if (task.source_status?.trim()) return task.source_status.trim();

  const properties = task.raw_payload?.properties;
  if (!properties || typeof properties !== "object") return "";

  for (const property of Object.values(properties as Record<string, NotionProperty>)) {
    if (property?.type === "status") {
      const name = String(property?.status?.name || "").trim();
      if (name) return name;
    }
  }

  for (const [name, property] of Object.entries(properties as Record<string, NotionProperty>)) {
    if (property?.type === "select" && name.toLowerCase().includes("status")) {
      const value = String(property?.select?.name || "").trim();
      if (value) return value;
    }
  }

  return "";
}

function getStatusOptions(task: PersonalTaskDetail | null) {
  const currentSourceStatus = extractCurrentSourceStatus(task);
  const properties = task?.raw_payload?.properties;
  const schemaOptions: string[] = [];

  if (properties && typeof properties === "object") {
    for (const property of Object.values(properties as Record<string, NotionProperty>)) {
      if (property?.type === "status") {
        const options = property?.status?.options;
        if (Array.isArray(options)) {
          schemaOptions.push(
            ...options
              .map((option) => String(option?.name || "").trim())
              .filter(Boolean)
          );
        }
      }
    }

    for (const [name, property] of Object.entries(properties as Record<string, NotionProperty>)) {
      if (property?.type === "select" && name.toLowerCase().includes("status")) {
        const options = property?.select?.options;
        if (Array.isArray(options)) {
          schemaOptions.push(
            ...options
              .map((option) => String(option?.name || "").trim())
              .filter(Boolean)
          );
        }
      }
    }
  }

  return dedupeStatusOptions([
    currentSourceStatus,
    ...schemaOptions,
    ...FALLBACK_STATUS_OPTIONS.map((option) => option.source),
  ]);
}

export function PersonalTaskDrawer({ taskId, isOpen, onClose, onPromoted, onTaskUpdated }: PersonalTaskDrawerProps) {
  const router = useRouter();
  const [task, setTask] = useState<PersonalTaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [promoting, setPromoting] = useState(false);
  const [syncingToNotion, setSyncingToNotion] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [titleError, setTitleError] = useState<string | null>(null);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [draftDescription, setDraftDescription] = useState("");
  const skipTitleBlurRef = useRef(false);
  const { isOpen: isConfirmOpen, onOpen: onConfirmOpen, onClose: onConfirmClose } = useDisclosure();

  // Promotion form state
  const [promoTitle, setPromoTitle] = useState("");
  const [promoDescription, setPromoDescription] = useState("");
  const [promoAssignee, setPromoAssignee] = useState("");
  const [promoProject, setPromoProject] = useState("");
  const [promoPriority, setPromoPriority] = useState("0");
  const [promoStatus, setPromoStatus] = useState<"backlog" | "in_progress" | "blocked">("backlog");
  const [promoRelation, setPromoRelation] = useState<"delegated" | "related">("delegated");
  const [promoCreateAnother, setPromoCreateAnother] = useState(false);

  const statusOptions = useMemo(() => getStatusOptions(task), [task]);
  const selectedSourceStatus = useMemo(() => {
    if (!task) return "";

    const currentSourceStatus = extractCurrentSourceStatus(task);
    if (currentSourceStatus) return currentSourceStatus;

    const fallback = statusOptions.find((option) => option.canonical === task.status);
    return fallback?.source || task.status;
  }, [task, statusOptions]);

  useEffect(() => {
    if (isOpen && taskId) {
      setLoading(true);
      Promise.all([api.getPersonalTask(taskId), api.getProjects()])
        .then(([taskData, projectsData]) => {
          setTask(taskData);
          setProjects(projectsData);
          setPromoTitle(taskData.title);
          setPromoDescription(taskData.description || "");
          setPromoPriority(String(taskData.priority));
          setDraftTitle(taskData.title);
          setTitleError(null);
          setIsEditingTitle(false);
          setDraftDescription(taskData.description || "");
          setIsEditingDescription(false);
          setSyncError(null);
          setLoading(false);
        })
        .catch((err) => {
          console.error("Failed to load personal task details:", err);
          setLoading(false);
        });
    }
  }, [isOpen, taskId]);

  useEffect(() => {
    if (!isEditingTitle && task) {
      setDraftTitle(task.title);
    }
  }, [isEditingTitle, task]);

  const patchTask = async (
    payload: Parameters<typeof api.updatePersonalTask>[1],
    optimisticTask: PersonalTaskDetail,
  ) => {
    if (!task) return false;

    const previousTask = task;
    setTask(optimisticTask);
    setSyncingToNotion(true);
    setSyncError(null);

    try {
      const updated = await api.updatePersonalTask(task.id, payload);
      setTask((current) => (current ? ({ ...current, ...updated } as PersonalTaskDetail) : current));
      onTaskUpdated?.();
      return true;
    } catch (err: unknown) {
      console.error("Failed to update personal task:", err);
      setTask(previousTask);
      setSyncError(err instanceof Error ? err.message : "Failed to sync updates to Notion.");
      return false;
    } finally {
      setSyncingToNotion(false);
    }
  };

  const handleStatusChange = async (sourceStatus: string) => {
    if (!task || !sourceStatus || sourceStatus === selectedSourceStatus) return;

    const canonical = normalizeSourceStatus(sourceStatus);
    await patchTask(
      {
        source_status: sourceStatus,
        status: canonical,
      },
      {
        ...task,
        source_status: sourceStatus,
        status: canonical,
      },
    );
  };

  const handleDateChange = async (field: "due_at" | "scheduled_at", dateValue: DateValue | null) => {
    if (!task) return;
    const nextIso = toIsoDateFromCalendar(dateValue);

    await patchTask(
      { [field]: nextIso },
      {
        ...task,
        [field]: nextIso,
      } as PersonalTaskDetail,
    );
  };

  const saveTitle = async () => {
    if (!task) return;

    const nextTitle = draftTitle.trim();
    if (!nextTitle) {
      setTitleError("Title is required.");
      return;
    }

    if (nextTitle === task.title) {
      setTitleError(null);
      setIsEditingTitle(false);
      return;
    }

    const didSave = await patchTask(
      { title: nextTitle },
      {
        ...task,
        title: nextTitle,
      },
    );

    if (didSave) {
      setPromoTitle(nextTitle);
      setDraftTitle(nextTitle);
      setTitleError(null);
      setIsEditingTitle(false);
    }
  };

  const saveDescription = async () => {
    if (!task) return;

    const nextDescription = draftDescription.trim() ? draftDescription : null;
    const didSave = await patchTask(
      { description: nextDescription },
      {
        ...task,
        description: nextDescription,
      },
    );

    if (didSave) {
      setIsEditingDescription(false);
    }
  };

  const handlePromote = async (createAnother = false) => {
    if (!task) return;
    setPromoting(true);
    try {
      const result = await api.promotePersonalTask(task.id, {
        title: promoTitle,
        description: promoDescription || undefined,
        assignee: promoAssignee || undefined,
        project_id: promoProject || undefined,
        priority: parseInt(promoPriority),
        status: promoStatus,
        relation: promoRelation,
        create_another: createAnother
      });
      
      if (result.created) {
        onConfirmClose();
        // Refresh details to show the new link
        const updated = await api.getPersonalTask(taskId);
        setTask(updated);
        onPromoted?.();
      } else if (result.reason === "existing_open_link") {
        onConfirmOpen();
      }
    } catch (err) {
      console.error("Promotion failed:", err);
    } finally {
      setPromoting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />

      <div className="fixed right-0 top-0 z-50 flex h-[100dvh] w-full max-w-lg flex-col border-l border-zinc-200 dark:border-white/10 bg-white dark:bg-[#080808] font-sans shadow-none">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 dark:border-white/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-sm border border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/5">
              <User size={16} className="text-zinc-600 dark:text-zinc-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Personal Task</h2>
              <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-zinc-500">Notion Sync</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-sm border border-transparent p-1.5 text-zinc-600 dark:text-zinc-400 hover:border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:bg-white/5 hover:text-zinc-800 dark:text-zinc-200">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-8 overflow-y-auto p-5">
          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <Spinner color="primary" />
            </div>
          ) : task ? (
            <>
              {/* Main Info */}
              <div className="space-y-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    {isEditingTitle ? (
                      <>
                        <Input
                          aria-label="Edit Notion task title"
                          autoFocus
                          size="sm"
                          value={draftTitle}
                          onValueChange={setDraftTitle}
                          onBlur={() => {
                            if (skipTitleBlurRef.current) {
                              skipTitleBlurRef.current = false;
                              return;
                            }
                            void saveTitle();
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" && !event.shiftKey) {
                              event.preventDefault();
                              void saveTitle();
                            } else if (event.key === "Escape") {
                              event.preventDefault();
                              skipTitleBlurRef.current = true;
                              setDraftTitle(task.title);
                              setTitleError(null);
                              setIsEditingTitle(false);
                            }
                          }}
                          isDisabled={syncingToNotion}
                          endContent={syncingToNotion ? <Spinner size="sm" /> : undefined}
                          variant="flat"
                          classNames={{
                            input: "text-lg font-semibold text-zinc-900 dark:text-zinc-100",
                            inputWrapper: "min-h-0 rounded-sm border border-zinc-200 bg-zinc-100 px-2 shadow-none dark:border-white/10 dark:bg-white/5",
                          }}
                        />
                        {titleError && <p className="text-[12px] text-danger">{titleError}</p>}
                      </>
                    ) : (
                      <button
                        type="button"
                        className="-ml-1 w-full rounded-sm px-1 py-0.5 text-left transition-colors hover:bg-zinc-100 dark:hover:bg-white/5"
                        onClick={() => {
                          setDraftTitle(task.title);
                          setTitleError(null);
                          setIsEditingTitle(true);
                        }}
                      >
                        <h1 className="text-xl font-semibold leading-tight text-zinc-900 dark:text-zinc-100">{task.title}</h1>
                      </button>
                    )}
                  </div>
                  {task.source_url && (
                    <Button
                      isIconOnly
                      size="sm"
                      variant="flat"
                      as="a"
                      href={task.source_url}
                      target="_blank"
                      className="h-7 w-7 min-w-0 rounded-sm border border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/5 text-zinc-700 dark:text-zinc-300"
                    >
                      <ExternalLink size={14} />
                    </Button>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                    {syncingToNotion ? (
                      <>
                        <Spinner size="sm" />
                        <span>Syncing to Notion...</span>
                      </>
                    ) : (
                      <span>Synced {timeAgo(task.last_synced_at)}</span>
                    )}
                  </div>
                  {syncError && <p className="text-[11px] text-danger">{syncError}</p>}
                </div>

                <div className="grid grid-cols-[100px_1fr] gap-y-2 text-[13px]">
                  <div className="flex items-center text-zinc-500">Status</div>
                  <div className="flex items-center">
                    <Select
                      key={`${task.id}:${selectedSourceStatus}`}
                      disallowEmptySelection
                      size="sm"
                      variant="flat"
                      selectedKeys={selectedSourceStatus ? [selectedSourceStatus] : []}
                      onSelectionChange={(keys) => {
                        const next = Array.from(keys)[0] as string | undefined;
                        if (next) {
                          void handleStatusChange(next);
                        }
                      }}
                      isDisabled={syncingToNotion}
                      aria-label="Status"
                      className="max-w-xs"
                      classNames={{
                        trigger:
                          "-ml-2 h-8 min-h-8 rounded-sm border border-transparent bg-transparent px-2 py-1 shadow-none hover:border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:bg-white/5 data-[hover=true]:bg-zinc-100 dark:bg-white/5 data-[open=true]:border-zinc-200 dark:border-white/10",
                        value: "text-sm text-zinc-800 dark:text-zinc-200",
                        popoverContent: "border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#0d0d0d]",
                      }}
                    >
                      {statusOptions.map((option) => (
                        <SelectItem key={option.source}>{option.source}</SelectItem>
                      ))}
                    </Select>
                  </div>

                  <div className="flex items-center text-zinc-500">Due</div>
                  <div className="flex items-center gap-2">
                    <DatePicker
                      aria-label="Due date"
                      granularity="day"
                      hideTimeZone
                      showMonthAndYearPickers
                      value={toCalendarDateValue(task.due_at)}
                      onChange={(value) => {
                        void handleDateChange("due_at", value);
                      }}
                      isDisabled={syncingToNotion}
                      variant="flat"
                      size="sm"
                      className="max-w-[220px]"
                      classNames={{
                        inputWrapper:
                          "rounded-sm border border-zinc-200 dark:border-white/10 bg-transparent hover:bg-zinc-100 dark:hover:bg-white/5",
                        input: "font-mono text-sm text-zinc-800 dark:text-zinc-200",
                        selectorButton:
                          "h-7 w-7 min-w-0 rounded-sm border border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/5 text-zinc-600 dark:text-zinc-300",
                        popoverContent: "border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#0d0d0d]",
                        calendarContent: "bg-white dark:bg-[#0d0d0d]",
                      }}
                    />
                    {task.due_at && (
                      <Button
                        size="sm"
                        variant="light"
                        className="h-6 min-w-0 rounded-sm border border-zinc-200 dark:border-white/10 px-2 font-mono text-[10px] text-zinc-600 dark:text-zinc-400"
                        onPress={() => {
                          void handleDateChange("due_at", null);
                        }}
                        isDisabled={syncingToNotion}
                      >
                        Clear
                      </Button>
                    )}
                  </div>

                  <div className="flex items-center text-zinc-500">Scheduled</div>
                  <div className="flex items-center gap-2">
                    <DatePicker
                      aria-label="Scheduled date"
                      granularity="day"
                      hideTimeZone
                      showMonthAndYearPickers
                      value={toCalendarDateValue(task.scheduled_at)}
                      onChange={(value) => {
                        void handleDateChange("scheduled_at", value);
                      }}
                      isDisabled={syncingToNotion}
                      variant="flat"
                      size="sm"
                      className="max-w-[220px]"
                      classNames={{
                        inputWrapper:
                          "rounded-sm border border-zinc-200 dark:border-white/10 bg-transparent hover:bg-zinc-100 dark:hover:bg-white/5",
                        input: "font-mono text-sm text-zinc-800 dark:text-zinc-200",
                        selectorButton:
                          "h-7 w-7 min-w-0 rounded-sm border border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/5 text-zinc-600 dark:text-zinc-300",
                        popoverContent: "border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#0d0d0d]",
                        calendarContent: "bg-white dark:bg-[#0d0d0d]",
                      }}
                    />
                    {task.scheduled_at && (
                      <Button
                        size="sm"
                        variant="light"
                        className="h-6 min-w-0 rounded-sm border border-zinc-200 dark:border-white/10 px-2 font-mono text-[10px] text-zinc-600 dark:text-zinc-400"
                        onPress={() => {
                          void handleDateChange("scheduled_at", null);
                        }}
                        isDisabled={syncingToNotion}
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                </div>

                <div className="rounded-md border border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/5 p-3 focus-within:ring-1 focus-within:ring-zinc-300 dark:focus-within:ring-white/20">
                  {isEditingDescription ? (
                    <>
                      <Textarea
                        value={draftDescription}
                        onValueChange={setDraftDescription}
                        minRows={4}
                        variant="flat"
                        autoFocus
                        classNames={{
                          inputWrapper: "bg-transparent px-1 shadow-none",
                          input: "text-sm leading-relaxed text-zinc-700 dark:text-zinc-300",
                        }}
                        onKeyDown={(e) => {
                          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                            e.preventDefault();
                            void saveDescription();
                          }
                        }}
                        isDisabled={syncingToNotion}
                      />
                      <div className="mt-3 flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="flat"
                          className="rounded-sm border border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/5 text-zinc-700 dark:text-zinc-300"
                          onPress={() => {
                            setDraftDescription(task.description || "");
                            setIsEditingDescription(false);
                          }}
                          isDisabled={syncingToNotion}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          color="primary"
                          className="rounded-sm"
                          onPress={() => {
                            void saveDescription();
                          }}
                          isLoading={syncingToNotion}
                        >
                          Save
                        </Button>
                      </div>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="w-full rounded-sm p-2 text-left transition-colors hover:bg-zinc-100 dark:bg-white/5"
                      onClick={() => {
                        setDraftDescription(task.description || "");
                        setIsEditingDescription(true);
                      }}
                    >
                      {task.description ? (
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{task.description}</p>
                      ) : (
                        <span className="text-sm text-zinc-500">Add description...</span>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Promotion / Delegation */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Delegation</h3>
                  {task.link_count > 0 && (
                    <Chip
                      size="sm"
                      variant="dot"
                      color="primary"
                      className="h-5 border border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/5 font-mono text-[10px]"
                    >
                      {task.link_count} Linked {task.link_count === 1 ? "Task" : "Tasks"}
                    </Chip>
                  )}
                </div>

                {task.linked_team_tasks.length > 0 ? (
                  <div className="space-y-3">
                    {task.linked_team_tasks.map((link) => (
                      <Card key={link.id} className="rounded-sm border border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/5 shadow-none">
                        <CardBody className="p-3">
                          <div className="flex items-start justify-between">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                {link.team_task?.title || "Deleted Team Task"}
                              </p>
                              <div className="mt-1 flex items-center gap-2 font-mono text-[10px] text-zinc-500">
                                <span className="capitalize">{link.team_task?.status || "unknown"}</span>
                                <span>•</span>
                                <span>Assigned to {link.team_task?.assignee || "nobody"}</span>
                                {link.team_task?.project_name && (
                                  <>
                                    <span>•</span>
                                    <span className="flex items-center gap-1"><Folder size={10} /> {link.team_task.project_name}</span>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col gap-2">
                              <Chip
                                size="sm"
                                variant="flat"
                                className="h-5 border border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/5 font-mono text-[10px] uppercase"
                              >
                                {link.relation}
                              </Chip>
                              {link.team_task && (
                                <Button
                                  isIconOnly
                                  size="sm"
                                  variant="light"
                                  className="h-6 w-6 min-w-0 rounded-sm border border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/5 text-zinc-700 dark:text-zinc-300"
                                  onPress={() => {
                                    onClose();
                                    router.push(`/tasks?task=${link.team_task_id}`);
                                  }}
                                >
                                  <ArrowUpRight size={13} />
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardBody>
                      </Card>
                    ))}
                    
                    <Button
                      fullWidth
                      variant="flat"
                      color="primary"
                      className="rounded-sm border border-zinc-200 dark:border-white/10"
                      startContent={<ArrowUpCircle size={18} />}
                      onPress={() => {
                        setPromoCreateAnother(true);
                        onConfirmOpen();
                      }}
                    >
                      Delegate Again
                    </Button>
                  </div>
                ) : (
                  <Card className="rounded-sm border border-dashed border-zinc-300 dark:border-white/20 bg-zinc-50 dark:bg-white/[0.03] shadow-none">
                    <CardBody className="flex flex-col items-center justify-center py-8 text-center">
                      <div className="mb-3 rounded-sm border border-zinc-200 dark:border-white/10 bg-primary-500/10 p-3 text-primary-400">
                        <Bot size={22} />
                      </div>
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Needs follow-through?</p>
                      <p className="mt-1 text-xs text-zinc-500">Promote this to a team task to assign it to an agent.</p>
                      <Button
                        className="mt-4 rounded-sm border border-zinc-200 dark:border-white/10"
                        color="primary"
                        startContent={<ArrowUpCircle size={18} />}
                        onPress={() => {
                          setPromoCreateAnother(false);
                          onConfirmOpen();
                        }}
                      >
                        Create Team Task
                      </Button>
                    </CardBody>
                  </Card>
                )}
              </div>

              {/* Links Table Metadata */}
              {task.raw_payload && (
                <div className="space-y-4 border-t border-zinc-200 dark:border-white/10 pt-4">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Source Metadata</h3>
                  <div className="overflow-x-auto rounded-sm border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/[0.03] p-4 font-mono text-[10px] text-zinc-600 dark:text-zinc-400">
                    <pre>{JSON.stringify(task.raw_payload.properties, null, 2)}</pre>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="py-20 text-center text-zinc-500">Task not found.</div>
          )}
        </div>
      </div>

      {/* Promotion Modal */}
      <Modal
        isOpen={isConfirmOpen}
        onClose={onConfirmClose}
        className="border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#080808] text-zinc-900 dark:text-zinc-100"
        placement="top-center"
        backdrop="opaque"
        classNames={{
          backdrop: "bg-black/70",
        }}
      >
        <ModalContent className="rounded-sm border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#080808] shadow-none">
          <ModalHeader className="border-b border-zinc-200 dark:border-white/10 text-sm">Delegate to Team</ModalHeader>
          <ModalBody className="gap-4 py-6">
            <Input
              label="Task Title"
              value={promoTitle}
              onValueChange={setPromoTitle}
              variant="bordered"
              size="sm"
              classNames={{ inputWrapper: "border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/5" }}
            />
            <Textarea
              label="Description"
              placeholder="Add more context for the team..."
              value={promoDescription}
              onValueChange={setPromoDescription}
              variant="bordered"
              size="sm"
              minRows={2}
              classNames={{ inputWrapper: "border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/5" }}
            />
            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Assignee"
                placeholder="Unassigned"
                selectedKeys={promoAssignee ? [promoAssignee] : []}
                onSelectionChange={(keys) => setPromoAssignee(Array.from(keys)[0] as string || "")}
                variant="bordered"
                size="sm"
                classNames={{ trigger: "border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/5" }}
              >
                {AGENTS.map((a) => (
                  <SelectItem key={a} className="capitalize">{a}</SelectItem>
                ))}
              </Select>
              <Select
                label="Status"
                selectedKeys={[promoStatus]}
                onSelectionChange={(keys) => {
                  const next = Array.from(keys)[0];
                  if (next === "backlog" || next === "in_progress" || next === "blocked") {
                    setPromoStatus(next);
                  }
                }}
                variant="bordered"
                size="sm"
                classNames={{ trigger: "border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/5" }}
              >
                <SelectItem key="backlog">Backlog</SelectItem>
                <SelectItem key="in_progress">In Progress</SelectItem>
                <SelectItem key="blocked">Blocked</SelectItem>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Priority"
                selectedKeys={[promoPriority]}
                onSelectionChange={(keys) => setPromoPriority(Array.from(keys)[0] as string || "0")}
                variant="bordered"
                size="sm"
                classNames={{ trigger: "border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/5" }}
              >
                {PRIORITIES.map((p) => (
                  <SelectItem key={p.value}>{p.label}</SelectItem>
                ))}
              </Select>
              <Select
                label="Relation"
                selectedKeys={[promoRelation]}
                onSelectionChange={(keys) => {
                  const next = Array.from(keys)[0];
                  if (next === "delegated" || next === "related") {
                    setPromoRelation(next);
                  }
                }}
                variant="bordered"
                size="sm"
                classNames={{ trigger: "border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/5" }}
              >
                <SelectItem key="delegated">Delegated</SelectItem>
                <SelectItem key="related">Related</SelectItem>
              </Select>
            </div>
            <Select
              label="Project"
              placeholder="No project"
              selectedKeys={promoProject ? [promoProject] : []}
              onSelectionChange={(keys) => setPromoProject(Array.from(keys)[0] as string || "")}
              variant="bordered"
              size="sm"
              classNames={{ trigger: "border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/5" }}
            >
              {projects.map((p) => (
                <SelectItem key={p.id}>{p.name}</SelectItem>
              ))}
            </Select>

            {task?.open_link_count && task.open_link_count > 0 ? (
               <div className="mt-2 space-y-2 rounded-sm border border-amber-400/30 bg-amber-500/10 p-3 text-xs text-amber-300">
                 <p>Note: This personal task already has an active link to a team task.</p>
                 <Checkbox
                   size="sm"
                   isSelected={promoCreateAnother}
                   onValueChange={setPromoCreateAnother}
                   classNames={{ label: "font-mono text-[10px] text-amber-300" }}
                 >
                   Force create another team task
                 </Checkbox>
               </div>
            ) : null}
          </ModalBody>
          <ModalFooter className="border-t border-zinc-200 dark:border-white/10">
            <Button variant="flat" onPress={onConfirmClose} size="sm" className="rounded-sm border border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/5 text-zinc-700 dark:text-zinc-300">
              Cancel
            </Button>
            <Button
              color="primary"
              onPress={() => handlePromote(promoCreateAnother)}
              isLoading={promoting}
              size="sm"
              className="rounded-sm border border-zinc-200 dark:border-white/10"
              startContent={!promoting && <ArrowUpCircle size={16} />}
            >
              {task?.link_count && !promoCreateAnother ? "Re-delegate" : (task?.link_count ? "Delegate Again" : "Delegate Task")}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
