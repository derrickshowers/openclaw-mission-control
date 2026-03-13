"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  Button,
  Tooltip,
  Spinner,
  Card,
} from "@heroui/react";
import {
  ExternalLink,
  RefreshCw,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowUpCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { api, type PersonalTask } from "@/lib/api";
import { formatLocal, timeAgo } from "@/lib/dates";
import { PersonalTaskDrawer } from "./personal-task-drawer";
import { useSSE } from "@/hooks/use-sse";

type PersonalFilter = "all" | "today" | "next_7_days" | "overdue";
type TaskEmphasis = "today" | "next7" | "overdue" | "default";

const statusConfig: Record<string, { color: "default" | "primary" | "danger" | "success" | "warning"; icon: LucideIcon }> = {
  backlog: { color: "default", icon: Clock },
  in_progress: { color: "primary", icon: RefreshCw },
  blocked: { color: "danger", icon: AlertCircle },
  done: { color: "success", icon: CheckCircle2 },
};

const priorityConfig: Record<number, { label: string; color: "default" | "warning" | "danger" }> = {
  0: { label: "None", color: "default" },
  1: { label: "Low", color: "default" },
  2: { label: "Medium", color: "warning" },
  3: { label: "High", color: "danger" },
  4: { label: "Urgent", color: "danger" },
};

interface PersonalTaskListProps {
  initialTasks: PersonalTask[];
}

interface TaskMeta {
  scheduledToday: boolean;
  dueToday: boolean;
  dueWithinNext7: boolean;
  dueSoonUnscheduled: boolean;
  overdue: boolean;
  emphasis: TaskEmphasis;
  sortRank: number;
  dueTimestamp: number | null;
  scheduledTimestamp: number | null;
}

const EMPTY_META: TaskMeta = {
  scheduledToday: false,
  dueToday: false,
  dueWithinNext7: false,
  dueSoonUnscheduled: false,
  overdue: false,
  emphasis: "default",
  sortRank: 4,
  dueTimestamp: null,
  scheduledTimestamp: null,
};

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function parseDate(iso: string | null | undefined) {
  if (!iso) return null;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getTaskMeta(task: PersonalTask, now: Date): TaskMeta {
  const due = parseDate(task.due_at);
  const scheduled = parseDate(task.scheduled_at);
  const todayStart = startOfDay(now);
  const nextWeekExclusive = addDays(todayStart, 8);
  const isDone = task.status === "done";

  const scheduledToday = !!scheduled && isSameDay(scheduled, now);
  const dueToday = !!due && isSameDay(due, now);
  const overdue = !!due && due < todayStart && !isDone;
  const dueWithinNext7 = !!due && due >= todayStart && due < nextWeekExclusive && !isDone;
  const dueSoonUnscheduled = dueWithinNext7 && !scheduledToday;

  let emphasis: TaskEmphasis = "default";
  let sortRank = 4;

  if (scheduledToday) {
    emphasis = "today";
    sortRank = 0;
  } else if (dueSoonUnscheduled) {
    emphasis = "next7";
    sortRank = 1;
  } else if (overdue) {
    emphasis = "overdue";
    sortRank = 2;
  }

  return {
    scheduledToday,
    dueToday,
    dueWithinNext7,
    dueSoonUnscheduled,
    overdue,
    emphasis,
    sortRank,
    dueTimestamp: due ? due.getTime() : null,
    scheduledTimestamp: scheduled ? scheduled.getTime() : null,
  };
}

export function PersonalTaskList({ initialTasks }: PersonalTaskListProps) {
  const [tasks, setTasks] = useState<PersonalTask[]>(initialTasks);
  const [filter, setFilter] = useState<PersonalFilter>("all");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const fetchTasks = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.getPersonalTasks({ limit: 500 });
      setTasks(data);
    } catch (err) {
      console.error("Failed to fetch personal tasks:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const taskMetaById = useMemo(() => {
    const now = new Date();
    const meta = new Map<string, TaskMeta>();
    for (const task of tasks) {
      meta.set(task.id, getTaskMeta(task, now));
    }
    return meta;
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    const scoped = tasks.filter((task) => {
      const meta = taskMetaById.get(task.id) || EMPTY_META;
      if (filter === "today") return meta.scheduledToday || meta.dueToday;
      if (filter === "next_7_days") return meta.dueSoonUnscheduled;
      if (filter === "overdue") return meta.overdue;
      return true;
    });

    return scoped.sort((a, b) => {
      const aMeta = taskMetaById.get(a.id) || EMPTY_META;
      const bMeta = taskMetaById.get(b.id) || EMPTY_META;

      if (aMeta.sortRank !== bMeta.sortRank) return aMeta.sortRank - bMeta.sortRank;

      if (aMeta.dueTimestamp !== null && bMeta.dueTimestamp !== null && aMeta.dueTimestamp !== bMeta.dueTimestamp) {
        return aMeta.dueTimestamp - bMeta.dueTimestamp;
      }

      if (aMeta.scheduledTimestamp !== null && bMeta.scheduledTimestamp !== null && aMeta.scheduledTimestamp !== bMeta.scheduledTimestamp) {
        return aMeta.scheduledTimestamp - bMeta.scheduledTimestamp;
      }

      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }, [tasks, filter, taskMetaById]);

  const filterCounts = useMemo(() => {
    let today = 0;
    let next7 = 0;
    let overdue = 0;

    for (const task of tasks) {
      const meta = taskMetaById.get(task.id) || EMPTY_META;
      if (meta.scheduledToday || meta.dueToday) today += 1;
      if (meta.dueSoonUnscheduled) next7 += 1;
      if (meta.overdue) overdue += 1;
    }

    return {
      all: tasks.length,
      today,
      next_7_days: next7,
      overdue,
    };
  }, [tasks, taskMetaById]);

  const handleSync = async (runType: "incremental" | "full" = "incremental") => {
    setIsSyncing(true);
    try {
      await api.syncPersonalTasks(runType);
    } catch (err) {
      console.error("Sync failed:", err);
      setIsSyncing(false);
    }
  };

  const { lastEvent } = useSSE([
    "personal_task.sync.completed",
    "personal_task.promoted",
    "personal_task.updated",
    "personal_task.scheduled",
  ]);

  useEffect(() => {
    if (!lastEvent) return;
    if (lastEvent.event === "personal_task.sync.completed") {
      setIsSyncing(false);
      fetchTasks();
    }
    if (
      lastEvent.event === "personal_task.promoted" ||
      lastEvent.event === "personal_task.updated" ||
      lastEvent.event === "personal_task.scheduled"
    ) {
      fetchTasks();
    }
  }, [lastEvent, fetchTasks]);

  const renderCell = (task: PersonalTask, columnKey: React.Key) => {
    const meta = taskMetaById.get(task.id) || EMPTY_META;

    switch (columnKey) {
      case "title": {
        const titleTone =
          meta.emphasis === "today"
            ? "text-zinc-900 dark:text-zinc-100"
            : meta.emphasis === "next7"
              ? "text-zinc-800 dark:text-zinc-200"
              : meta.emphasis === "overdue"
                ? "text-rose-300"
                : "text-zinc-500";

        const leftBorder =
          meta.emphasis === "today"
            ? "border-[#5e6ad2]"
            : meta.emphasis === "next7"
              ? "border-zinc-300 dark:border-white/20"
              : meta.emphasis === "overdue"
                ? "border-rose-500/70"
                : "border-transparent";

        return (
          <div className={`flex flex-col gap-1 border-l-2 pl-3 ${leftBorder}`}>
            <span className={`text-[13px] font-medium leading-tight ${titleTone}`}>{task.title}</span>
            <span className="truncate max-w-[320px] text-[12px] text-zinc-500">
              {task.description || "No description"}
            </span>
          </div>
        );
      }

      case "status": {
        const config = statusConfig[task.status] || statusConfig.backlog;
        const Icon = config.icon;
        return (
          <Chip
            startContent={<Icon size={12} />}
            variant="flat"
            color={config.color}
            size="sm"
            className="h-6 border border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/5 font-mono text-[11px] capitalize"
          >
            {task.source_status || task.status.replace("_", " ")}
          </Chip>
        );
      }

      case "priority": {
        const pConfig = priorityConfig[task.priority] || priorityConfig[0];
        return (
          <Chip
            variant="dot"
            color={pConfig.color}
            size="sm"
            className="h-6 border border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/5 font-mono text-[11px]"
          >
            {pConfig.label}
          </Chip>
        );
      }

      case "due": {
        if (!task.due_at && !task.scheduled_at) {
          return <span className="font-mono text-[11px] text-zinc-500">-</span>;
        }

        return (
          <div className="flex flex-col gap-1.5 font-mono text-[11px]">
            {task.due_at && (
              <div
                className={`flex items-center gap-1.5 ${
                  meta.overdue ? "text-rose-400" : meta.dueSoonUnscheduled ? "text-amber-500/90" : "text-zinc-600 dark:text-zinc-400"
                }`}
              >
                <Calendar size={11} />
                <span>Due {formatLocal(task.due_at, { month: "short", day: "numeric" })}</span>
              </div>
            )}
            {task.scheduled_at && (
              <div
                className={`flex items-center gap-1.5 ${
                  meta.scheduledToday ? "text-[#5e6ad2] dark:text-[#8f98e8]" : "text-zinc-600 dark:text-zinc-400"
                }`}
              >
                <Clock size={11} />
                <span>Sched {formatLocal(task.scheduled_at, { month: "short", day: "numeric" })}</span>
              </div>
            )}
          </div>
        );
      }

      case "delegation": {
        if (!task.delegation) return <span className="text-[11px] text-zinc-600">—</span>;

        const teamStatus = task.delegation.status;
        const isTeamDone = teamStatus === "done";

        return (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <Chip
                size="sm"
                variant="flat"
                color={isTeamDone ? "success" : "primary"}
                className="h-5 border border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/5 font-mono text-[10px] uppercase"
              >
                {teamStatus.replace("_", " ")}
              </Chip>
              {task.delegation.assignee && <span className="font-mono text-[10px] text-zinc-500">@{task.delegation.assignee}</span>}
            </div>
            <span className="truncate max-w-[170px] text-[11px] text-zinc-500">{task.delegation.title}</span>
          </div>
        );
      }

      case "actions":
        return (
          <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
            {task.source_url && (
              <Button
                isIconOnly
                size="sm"
                variant="light"
                as="a"
                href={task.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="h-7 w-7 min-w-0 rounded-sm border border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/5 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:bg-white/10"
              >
                <ExternalLink size={13} />
              </Button>
            )}
            <Button
              size="sm"
              variant="flat"
              className="h-7 rounded-sm border border-zinc-200 dark:border-white/10 bg-zinc-200 dark:bg-white/10 px-2 font-mono text-[10px] uppercase tracking-wide text-zinc-900 dark:text-zinc-100"
              onPress={() => setSelectedTaskId(task.id)}
            >
              Details
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  const filterButtons: Array<{ key: PersonalFilter; label: string }> = [
    { key: "all", label: "All" },
    { key: "today", label: "Today" },
    { key: "next_7_days", label: "Next 7 Days" },
    { key: "overdue", label: "Overdue" },
  ];

  return (
    <div className="space-y-4 font-sans">
      <div className="flex flex-col gap-3 px-1 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#080808] p-1">
          {filterButtons.map((option) => {
            const isActive = filter === option.key;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => setFilter(option.key)}
                className={
                  isActive
                    ? "rounded-sm border border-zinc-200 dark:border-white/10 bg-zinc-200 dark:bg-white/10 px-3 py-1 text-[12px] text-zinc-900 dark:text-zinc-100"
                    : "rounded-sm px-3 py-1 text-[12px] text-zinc-500 hover:bg-zinc-100 dark:bg-white/5 hover:text-zinc-700 dark:text-zinc-300"
                }
              >
                {option.label}
                <span className="ml-1.5 font-mono text-[10px] text-zinc-600 dark:text-zinc-400">
                  {filterCounts[option.key]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 pr-1">
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{filteredTasks.length} items</span>
            {tasks.length > 0 && <span className="font-mono text-[10px] text-zinc-600">Synced {timeAgo(tasks[0].last_synced_at)}</span>}
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="flat"
              onPress={() => handleSync("incremental")}
              isLoading={isSyncing}
              startContent={!isSyncing && <RefreshCw size={13} />}
              className="h-7 rounded-sm border border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/5 px-3 font-mono text-[11px] text-zinc-800 dark:text-zinc-200"
            >
              {isSyncing ? "Syncing..." : "Sync"}
            </Button>
            <Tooltip content="Full reconcile (slow)">
              <Button
                isIconOnly
                size="sm"
                variant="flat"
                onPress={() => handleSync("full")}
                isLoading={isSyncing}
                className="h-7 w-7 min-w-0 rounded-sm border border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/5"
              >
                <ArrowUpCircle size={13} className="rotate-180 text-zinc-700 dark:text-zinc-300" />
              </Button>
            </Tooltip>
          </div>
        </div>
      </div>

      <div className="hidden md:block">
      <Card className="rounded-md border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#080808] shadow-none">
        <Table
          aria-label="Personal tasks table"
          classNames={{
            base: "max-h-[70vh] overflow-y-auto",
            table: "min-w-[880px]",
            thead: "bg-zinc-50 dark:bg-white/[0.03]",
            th: "border-b border-zinc-200 dark:border-white/10 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500",
            td: "border-b border-zinc-100 dark:border-white/5 py-2.5",
          }}
          removeWrapper
        >
          <TableHeader>
            <TableColumn key="title">Task</TableColumn>
            <TableColumn key="status" width={160}>
              Status
            </TableColumn>
            <TableColumn key="priority" width={120}>
              Priority
            </TableColumn>
            <TableColumn key="due" width={170}>
              Date
            </TableColumn>
            <TableColumn key="delegation" width={220}>
              Team Progress
            </TableColumn>
            <TableColumn key="actions" width={140} align="end">
              Actions
            </TableColumn>
          </TableHeader>
          <TableBody
            items={filteredTasks}
            loadingContent={<Spinner size="sm" />}
            isLoading={isLoading}
            emptyContent={isLoading ? " " : "No personal tasks found."}
          >
            {(item) => {
              const meta = taskMetaById.get(item.id) || EMPTY_META;
              const rowTone =
                meta.emphasis === "today"
                  ? "bg-[#5e6ad2]/[0.07]"
                  : meta.emphasis === "next7"
                    ? "bg-amber-500/[0.04]"
                    : meta.emphasis === "overdue"
                      ? "bg-rose-500/[0.04]"
                      : "";

              return (
                <TableRow
                  key={item.id}
                  className={`cursor-pointer transition-colors hover:bg-zinc-100 dark:bg-white/5 ${rowTone}`}
                  onClick={() => setSelectedTaskId(item.id)}
                >
                  {(columnKey) => <TableCell>{renderCell(item, columnKey)}</TableCell>}
                </TableRow>
              );
            }}
          </TableBody>
        </Table>
      </Card>
      </div>

      <div className="flex flex-col gap-3 md:hidden">
        {isLoading && filteredTasks.length === 0 && (
          <div className="flex justify-center py-8"><Spinner size="sm" /></div>
        )}
        {!isLoading && filteredTasks.length === 0 && (
          <div className="text-center py-8 text-[13px] text-zinc-500">No personal tasks found.</div>
        )}
        {filteredTasks.map((task) => {
          const meta = taskMetaById.get(task.id) || EMPTY_META;
          
          const leftBorder =
            meta.emphasis === "today"
              ? "border-[#5e6ad2]"
              : meta.emphasis === "next7"
                ? "border-zinc-300 dark:border-white/20"
                : meta.emphasis === "overdue"
                  ? "border-rose-500/70"
                  : "border-transparent";

          const titleTone =
            meta.emphasis === "today"
              ? "text-zinc-900 dark:text-zinc-100"
              : meta.emphasis === "next7"
                ? "text-zinc-800 dark:text-zinc-200"
                : meta.emphasis === "overdue"
                  ? "text-rose-300"
                  : "text-zinc-500";
                  
          const rowTone =
            meta.emphasis === "today"
              ? "bg-[#5e6ad2]/[0.07]"
              : meta.emphasis === "next7"
                ? "bg-amber-500/[0.04]"
                : meta.emphasis === "overdue"
                  ? "bg-rose-500/[0.04]"
                  : "bg-white dark:bg-[#080808]";

          return (
            <Card
              key={task.id}
              isPressable
              onPress={() => setSelectedTaskId(task.id)}
              className={`flex flex-col gap-3 rounded-md border border-zinc-200 dark:border-white/10 p-4 shadow-none border-l-2 ${leftBorder} ${rowTone}`}
            >
              <div className="flex flex-col gap-1 text-left w-full">
                <span className={`text-[14px] font-medium leading-tight ${titleTone}`}>
                  {task.title}
                </span>
                {task.description && (
                  <span className="line-clamp-2 text-[12px] text-zinc-500">
                    {task.description}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 mt-1 w-full">
                {renderCell(task, "status")}
                {renderCell(task, "priority")}
              </div>
              
              {(task.due_at || task.scheduled_at) && (
                <div className="w-full">
                  {renderCell(task, "due")}
                </div>
              )}

              {task.delegation && (
                <div className="mt-1 pt-3 border-t border-zinc-200 dark:border-white/10 w-full text-left">
                  {renderCell(task, "delegation")}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {selectedTaskId && (
        <PersonalTaskDrawer
          taskId={selectedTaskId}
          isOpen={!!selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          onPromoted={() => {
            fetchTasks();
          }}
          onTaskUpdated={() => {
            fetchTasks();
          }}
        />
      )}
    </div>
  );
}
