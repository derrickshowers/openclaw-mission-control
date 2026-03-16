"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, CardBody, Checkbox, Chip, Input, Spinner, Textarea } from "@heroui/react";
import {
  AlertCircle,
  CalendarCheck,
  Clock3,
  ExternalLink,
  MessageSquare,
  NotebookPen,
  Play,
  SquarePen,
  TriangleAlert,
  X,
} from "lucide-react";
import {
  api,
  type BeeInsight,
  type BrainChannelDetail,
  type BrainChannelSummary,
  type PersonalTask,
  type Task,
  type TodayNonNegotiable,
} from "@/lib/api";
import { parseUTC, timeAgo } from "@/lib/dates";
import { useSSE } from "@/hooks/use-sse";
import { TaskDrawer } from "@/components/tasks/task-drawer";
import { PersonalTaskDrawer } from "@/components/tasks/personal-task-drawer";
import { BrainChannelDrawer } from "./brain-channel-drawer";

interface DashboardContentProps {
  tasks: Task[];
  agents: any[];
  personalTasks: PersonalTask[];
}

const flatButtonClass =
  "rounded-sm border border-zinc-200 bg-zinc-100 text-zinc-800 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200";

function toLocalDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function startOfLocalDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addLocalDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function nextFridayDateKey(now = new Date()) {
  const d = new Date(now);
  const day = d.getDay();
  const friday = 5;
  let delta = (friday - day + 7) % 7;
  if (delta === 0) delta = 7;
  d.setDate(d.getDate() + delta);
  return toLocalDateKey(d);
}

function nearestQuarterHourIso(now = new Date()) {
  const d = new Date(now);
  const minutes = d.getMinutes();
  const rounded = Math.round(minutes / 15) * 15;
  d.setMinutes(rounded, 0, 0);
  return d.toISOString();
}

function mergeUniqueTasks(...groups: Task[][]) {
  const map = new Map<string, Task>();
  for (const group of groups) {
    for (const task of group) map.set(task.id, task);
  }
  return Array.from(map.values());
}

function sortTasksByUpdatedDesc(tasks: Task[]) {
  return [...tasks].sort(
    (a, b) => parseUTC(b.updated_at).getTime() - parseUTC(a.updated_at).getTime()
  );
}

const DATE_ONLY_VALUE_RE = /^(\d{4})-(\d{2})-(\d{2})(?:T00:00:00(?:\.000)?Z)?$/;

function parseCalendarDate(dateValue: string | null | undefined) {
  if (!dateValue) return null;

  const trimmed = dateValue.trim();
  const dateOnlyMatch = trimmed.match(DATE_ONLY_VALUE_RE);
  if (dateOnlyMatch) {
    return new Date(
      Number(dateOnlyMatch[1]),
      Number(dateOnlyMatch[2]) - 1,
      Number(dateOnlyMatch[3])
    );
  }

  const parsed = parseUTC(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function dayDiffFromNow(dateValue: string | null | undefined, now: Date) {
  const parsed = parseCalendarDate(dateValue);
  if (!parsed) return null;

  const valueDay = startOfLocalDay(parsed).getTime();
  const nowDay = startOfLocalDay(now).getTime();
  return Math.round((valueDay - nowDay) / 86_400_000);
}

function formatDueLabel(dateValue: string | null | undefined, now: Date) {
  const parsed = parseCalendarDate(dateValue);
  if (!parsed) return "";

  const diff = dayDiffFromNow(dateValue, now);
  if (diff !== null && diff >= 0 && diff <= 5) {
    return parsed.toLocaleDateString("en-US", { weekday: "short" });
  }

  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatScheduledLabel(dateValue: string | null | undefined) {
  const parsed = parseCalendarDate(dateValue);
  if (!parsed) return "";

  if (DATE_ONLY_VALUE_RE.test(dateValue?.trim() || "")) {
    return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function comparePersonalTasks(a: PersonalTask, b: PersonalTask) {
  const aScheduled = a.scheduled_at ? parseCalendarDate(a.scheduled_at)?.getTime() ?? Number.POSITIVE_INFINITY : Number.POSITIVE_INFINITY;
  const bScheduled = b.scheduled_at ? parseCalendarDate(b.scheduled_at)?.getTime() ?? Number.POSITIVE_INFINITY : Number.POSITIVE_INFINITY;
  const aDue = a.due_at ? parseCalendarDate(a.due_at)?.getTime() ?? Number.POSITIVE_INFINITY : Number.POSITIVE_INFINITY;
  const bDue = b.due_at ? parseCalendarDate(b.due_at)?.getTime() ?? Number.POSITIVE_INFINITY : Number.POSITIVE_INFINITY;

  if (aScheduled !== bScheduled) return aScheduled - bScheduled;
  if (aDue !== bDue) return aDue - bDue;
  return parseUTC(b.updated_at).getTime() - parseUTC(a.updated_at).getTime();
}

function hasScheduledTime(dateValue: string | null | undefined) {
  if (!dateValue) return false;
  return !DATE_ONLY_VALUE_RE.test(dateValue.trim());
}

function todayTaskSortBucket(task: PersonalTask) {
  if (hasScheduledTime(task.scheduled_at)) return 0;
  if (task.scheduled_at) return 1;
  return 2;
}

function compareTodayPersonalTasks(a: PersonalTask, b: PersonalTask) {
  const aDone = a.status === "done";
  const bDone = b.status === "done";
  if (aDone !== bDone) return aDone ? 1 : -1;

  const aBucket = todayTaskSortBucket(a);
  const bBucket = todayTaskSortBucket(b);
  if (aBucket !== bBucket) return aBucket - bBucket;

  return comparePersonalTasks(a, b);
}

function isSameLocalDay(dateValue: string | null | undefined, target: Date) {
  const parsed = parseCalendarDate(dateValue);
  if (!parsed) return false;
  return (
    parsed.getFullYear() === target.getFullYear() &&
    parsed.getMonth() === target.getMonth() &&
    parsed.getDate() === target.getDate()
  );
}

function isWithinNextSevenDays(dateValue: string | null | undefined, now: Date) {
  const parsed = parseCalendarDate(dateValue);
  if (!parsed) return false;
  const start = startOfLocalDay(now).getTime();
  const end = addLocalDays(startOfLocalDay(now), 8).getTime();
  const value = parsed.getTime();
  return value >= start && value < end;
}

function isDueTomorrow(dateValue: string | null | undefined, now: Date) {
  if (!dateValue) return false;
  return isSameLocalDay(dateValue, addLocalDays(now, 1));
}

function providerFromModel(model: string) {
  if (!model) return "other";
  if (model.includes("/")) return model.split("/")[0];
  return model.split("-")[0] || "other";
}

function formatCompactNumber(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(Math.round(value));
}

function formatUsd(value: number) {
  if (value < 0.01) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(2)}`;
}

function statusChipColor(status: Task["status"] | PersonalTask["status"]) {
  if (status === "blocked") return "danger" as const;
  if (status === "in_progress") return "primary" as const;
  if (status === "done") return "success" as const;
  return "default" as const;
}

const BEE_SOURCE_LABELS: Record<BeeInsight["source_type"], string> = {
  conversation: "conversation",
  daily_summary: "daily summary",
  journal: "journal",
  bee_todo: "bee todo",
};

const beeCardClass =
  "flex flex-col gap-2 rounded-md border border-zinc-200 bg-white p-3 transition-colors hover:border-zinc-300 dark:border-white/10 dark:bg-[#111] dark:hover:border-white/20";

function BeeInsightCard({
  insight,
  onAddToNotion,
  onDismiss,
}: {
  insight: BeeInsight;
  onAddToNotion: (insight: BeeInsight) => Promise<void>;
  onDismiss: (insight: BeeInsight) => Promise<void>;
}) {
  const [addingToNotion, setAddingToNotion] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [exiting, setExiting] = useState(false);

  const handleAddToNotion = async () => {
    setAddingToNotion(true);
    try {
      await onAddToNotion(insight);
      setExiting(true);
    } finally {
      setAddingToNotion(false);
    }
  };

  const handleDismiss = async () => {
    setDismissing(true);
    try {
      await onDismiss(insight);
      setExiting(true);
    } finally {
      setDismissing(false);
    }
  };

  if (exiting) return null;

  const confidenceDot =
    insight.confidence === "high"
      ? "bg-green-500"
      : insight.confidence === "medium"
        ? "bg-yellow-500"
        : "bg-zinc-500";

  const capturedAgo = timeAgo(insight.captured_at);

  return (
    <div className={beeCardClass}>
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 font-mono text-[11px] text-zinc-500 dark:text-gray-500">
          <MessageSquare size={11} />
          {BEE_SOURCE_LABELS[insight.source_type]}
        </span>
        <div className="flex items-center gap-3 font-mono text-[11px] text-zinc-500 dark:text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className={`h-[5px] w-[5px] rounded-full ${confidenceDot}`} />
            {insight.confidence}
          </span>
          <span>{capturedAgo}</span>
        </div>
      </div>

      <p className="text-[14px] font-medium leading-tight text-zinc-900 dark:text-gray-200">{insight.title}</p>
      <blockquote className="mt-0.5 border-l-2 border-zinc-200 pl-2 dark:border-white/10">
        <p className="line-clamp-2 text-[13px] italic text-zinc-500 dark:text-gray-400">{insight.evidence}</p>
      </blockquote>

      <div className="mt-1 flex items-center justify-between border-t border-zinc-100 pt-2 dark:border-white/5">
        <button
          type="button"
          onClick={() => void handleAddToNotion()}
          disabled={addingToNotion || dismissing}
          className="flex items-center gap-1.5 rounded-sm border border-zinc-200 bg-zinc-100 px-3 py-1.5 text-[12px] font-medium text-zinc-900 transition-colors hover:bg-zinc-200 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-300 focus-visible:ring-offset-1 focus-visible:ring-offset-white dark:border-white/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/15 dark:focus-visible:ring-white/30 dark:focus-visible:ring-offset-[#111]"
        >
          {addingToNotion ? (
            <span className="h-3 w-3 animate-spin rounded-full border border-white/40 border-t-white" />
          ) : (
            <NotebookPen size={12} />
          )}
          Add to Notion
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleDismiss()}
            disabled={addingToNotion || dismissing}
            className="rounded-sm px-2 py-1 text-[12px] text-zinc-500 transition-colors hover:text-rose-500 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-300 focus-visible:ring-offset-1 focus-visible:ring-offset-white dark:text-gray-500 dark:hover:text-red-400 dark:focus-visible:ring-white/30 dark:focus-visible:ring-offset-[#111]"
          >
            {dismissing ? (
              <span className="h-3 w-3 animate-spin rounded-full border border-white/30 border-t-gray-400" />
            ) : (
              <span className="flex items-center gap-1">
                <X size={12} />
                Dismiss
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function BeeInsightSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-2 rounded-md border border-zinc-200 bg-white p-3 dark:border-white/5 dark:bg-[#111]">
      <div className="flex items-center justify-between">
        <div className="h-3 w-24 rounded bg-zinc-200 dark:bg-white/5" />
        <div className="h-3 w-16 rounded bg-zinc-200 dark:bg-white/5" />
      </div>
      <div className="h-4 w-3/4 rounded bg-zinc-200 dark:bg-white/5" />
      <div className="space-y-1">
        <div className="h-3 w-full rounded bg-zinc-200 dark:bg-white/5" />
        <div className="h-3 w-2/3 rounded bg-zinc-200 dark:bg-white/5" />
      </div>
      <div className="mt-1 flex items-center justify-between border-t border-zinc-100 pt-2 dark:border-white/5">
        <div className="h-7 w-28 rounded-sm bg-zinc-200 dark:bg-white/5" />
        <div className="h-6 w-16 rounded-sm bg-zinc-200 dark:bg-white/5" />
      </div>
    </div>
  );
}

function TeamTaskCard({
  task,
  onOpen,
}: {
  task: Task;
  onOpen: (task: Task) => void;
}) {
  const tone =
    task.status === "blocked"
      ? "border-l-2 border-l-amber-500 bg-amber-500/[0.05]"
      : "border-l-2 border-l-emerald-500/70";

  return (
    <Card className={`rounded-md border border-zinc-200 bg-white shadow-none dark:border-white/10 dark:bg-[#080808] ${tone}`}>
      <CardBody className="gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{task.title}</h3>
              <Chip size="sm" variant="flat" color={statusChipColor(task.status)} className="h-5 text-[10px] uppercase">
                {task.status.replace("_", " ")}
              </Chip>
              {task.assignee && (
                <Chip size="sm" variant="flat" className="h-5 border border-zinc-200 bg-zinc-100 text-[10px] uppercase dark:border-white/10 dark:bg-white/5">
                  @{task.assignee}
                </Chip>
              )}
            </div>
            <p className="mt-1 text-[12px] text-zinc-500">
              Updated {timeAgo(task.updated_at)}
              {task.project?.name ? ` • ${task.project.name}` : ""}
            </p>
            {task.description && (
              <p className="mt-2 line-clamp-2 text-[13px] text-zinc-600 dark:text-zinc-300">
                {task.description}
              </p>
            )}
          </div>
          <Button size="sm" variant="flat" className={flatButtonClass} onPress={() => onOpen(task)}>
            Open
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

export function DashboardContent({ tasks: initialTasks, agents, personalTasks: initialPersonalTasks }: DashboardContentProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [personalTasks, setPersonalTasks] = useState<PersonalTask[]>(initialPersonalTasks);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedPersonalTaskId, setSelectedPersonalTaskId] = useState<string | null>(null);
  const [selectedBrainChannelId, setSelectedBrainChannelId] = useState<string | null>(null);
  const [nonNegotiables, setNonNegotiables] = useState<TodayNonNegotiable[]>([]);
  const [brainChannels, setBrainChannels] = useState<BrainChannelSummary[]>([]);
  const [beeInsights, setBeeInsights] = useState<BeeInsight[]>([]);
  const [beeInsightsLoading, setBeeInsightsLoading] = useState(true);
  const [usageByProvider, setUsageByProvider] = useState<Array<{ provider: string; tokens: number; cost: number }>>([]);
  const [todayLoading, setTodayLoading] = useState(true);
  const [creatingTask, setCreatingTask] = useState(false);
  const [startingTaskId, setStartingTaskId] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskScheduledAt, setNewTaskScheduledAt] = useState(toLocalDateKey(new Date()));
  const [newTaskDueAt, setNewTaskDueAt] = useState(nextFridayDateKey());
  const [newTaskNotes, setNewTaskNotes] = useState("");

  const refreshTeamTasks = useCallback(async () => {
    const [assigned, blocked, done] = await Promise.all([
      api.getTasks({ assignee: "derrick" }).catch(() => []),
      api.getTasks({ status: "blocked" }).catch(() => []),
      api.getTasks({ status: "done" }).catch(() => []),
    ]);
    setTasks(mergeUniqueTasks(assigned, blocked, done));
  }, []);

  const refreshPersonalTasks = useCallback(async () => {
    const rows = await api.getPersonalTasks({ limit: 100, sort: "due" }).catch(() => []);
    setPersonalTasks(rows);
  }, []);

  const refreshTodayData = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    const now = new Date();
    const today = toLocalDateKey(now);
    const start = startOfLocalDay(now).toISOString();
    const end = now.toISOString();

    if (!silent) {
      setTodayLoading(true);
    }

    try {
      const [nonNegotiableRows, brainChannelRows, usageRows] = await Promise.all([
        api.getTodayNonNegotiables({ date: today }).catch(() => []),
        api.getBrainChannels().catch(() => []),
        fetch(`/api/mc/usage/breakdown?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`)
          .then((res) => res.json())
          .catch(() => []),
      ]);

      setNonNegotiables(nonNegotiableRows);
      setBrainChannels(brainChannelRows);

      const grouped = new Map<string, { provider: string; tokens: number; cost: number }>();
      for (const row of Array.isArray(usageRows) ? usageRows : []) {
        const provider = providerFromModel(String(row.model || "other"));
        const entry = grouped.get(provider) || { provider, tokens: 0, cost: 0 };
        const totalTokens =
          row.total_tokens !== undefined
            ? Number(row.total_tokens || 0)
            : Number(row.input_tokens || 0) + Number(row.cached_input_tokens || 0) + Number(row.output_tokens || 0);
        entry.tokens += totalTokens;
        entry.cost += Number(row.cost_usd || 0);
        grouped.set(provider, entry);
      }

      setUsageByProvider(Array.from(grouped.values()).sort((a, b) => b.cost - a.cost || b.tokens - a.tokens));
    } finally {
      if (!silent) {
        setTodayLoading(false);
      }
    }
  }, []);

  const refreshTodayFromNotion = useCallback(
    async ({ runType = "incremental", silent = true }: { runType?: "incremental" | "full"; silent?: boolean } = {}) => {
      try {
        await api.syncPersonalTasks(runType);
      } catch {
        // Fall through and still refresh what we can.
      }

      await Promise.all([
        refreshPersonalTasks(),
        refreshTodayData({ silent }),
      ]);
    },
    [refreshPersonalTasks, refreshTodayData],
  );

  const refreshBeeInsights = useCallback(async () => {
    try {
      const rows = await api.getBeeInsights({ status: "new" });
      setBeeInsights(rows);
    } catch {
      // non-fatal; leave existing state
    } finally {
      setBeeInsightsLoading(false);
    }
  }, []);

  const handleAddInsightToNotion = useCallback(async (insight: BeeInsight) => {
    const created = await api.createPersonalTask({
      title: insight.title,
      description: insight.evidence,
    });
    await api.updateBeeInsight(insight.id, {
      status: "accepted",
      notion_page_id: created.id,
    });
    setBeeInsights((prev) => prev.filter((i) => i.id !== insight.id));
    await refreshPersonalTasks();
  }, [refreshPersonalTasks]);

  const handleDismissInsight = useCallback(async (insight: BeeInsight) => {
    await api.updateBeeInsight(insight.id, { status: "dismissed" });
    setBeeInsights((prev) => prev.filter((i) => i.id !== insight.id));
  }, []);

  useEffect(() => {
    void refreshTodayFromNotion({ runType: "full", silent: false });
  }, [refreshTodayFromNotion]);

  useEffect(() => {
    void refreshBeeInsights();
  }, [refreshBeeInsights]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void refreshTodayData({ silent: true });
    }, 60_000);

    const handleForegroundRefresh = () => {
      void refreshTodayFromNotion({ runType: "full", silent: true });
      void refreshBeeInsights();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        handleForegroundRefresh();
      }
    };

    window.addEventListener("focus", handleForegroundRefresh);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", handleForegroundRefresh);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshBeeInsights, refreshTodayData, refreshTodayFromNotion]);

  const { lastEvent } = useSSE([
    "personal_task.updated",
    "personal_task.scheduled",
    "personal_task.promoted",
    "personal_task.sync.completed",
    "task.updated",
    "task.created",
    "task.deleted",
    "task.moved",
  ]);

  useEffect(() => {
    if (!lastEvent) return;
    if (String(lastEvent.event).startsWith("personal_task.")) {
      void refreshPersonalTasks();
      if (lastEvent.event === "personal_task.sync.completed") {
        void refreshTodayData({ silent: true });
      }
    }
    if (String(lastEvent.event).startsWith("task.")) {
      void refreshTeamTasks();
    }
  }, [lastEvent, refreshPersonalTasks, refreshTeamTasks, refreshTodayData]);

  const now = new Date();
  const blockedTasks = useMemo(() => {
    return sortTasksByUpdatedDesc(tasks.filter((task) => task.status === "blocked" && !!task.assignee)).slice(0, 6);
  }, [tasks]);

  const recentCompletedTasks = useMemo(() => {
    return sortTasksByUpdatedDesc(tasks.filter((task) => task.status === "done")).slice(0, 6);
  }, [tasks]);

  const todayPersonalTasks = useMemo(() => {
    return [...personalTasks]
      .filter((task) => isSameLocalDay(task.scheduled_at, now) || (!task.scheduled_at && isWithinNextSevenDays(task.due_at, now)))
      .sort(compareTodayPersonalTasks);
  }, [personalTasks, now]);

  const openTodayPersonalTasks = useMemo(
    () => todayPersonalTasks.filter((task) => task.status !== "done"),
    [todayPersonalTasks],
  );

  const completedTodayPersonalTasks = useMemo(
    () => todayPersonalTasks.filter((task) => task.status === "done"),
    [todayPersonalTasks],
  );

  const handleCreateTask = async () => {
    const title = newTaskTitle.trim();
    if (!title) return;
    setCreatingTask(true);
    try {
      const created = await api.createPersonalTask({
        title,
        description: newTaskNotes.trim() || null,
        scheduled_at: newTaskScheduledAt || null,
        due_at: newTaskDueAt || null,
      });
      setNewTaskTitle("");
      setNewTaskNotes("");
      setNewTaskScheduledAt(toLocalDateKey(new Date()));
      setNewTaskDueAt(nextFridayDateKey());
      await refreshPersonalTasks();
      setSelectedPersonalTaskId(created.id);
    } finally {
      setCreatingTask(false);
    }
  };

  const handleStartWork = async (task: PersonalTask) => {
    setStartingTaskId(task.id);
    try {
      await api.startWorkOnPersonalTask(task.id, {
        started_at: nearestQuarterHourIso(new Date()),
        pressed_at: new Date().toISOString(),
      });
      await refreshPersonalTasks();
    } finally {
      setStartingTaskId(null);
    }
  };

  const morningPlanningVisible = now.getHours() >= 5 && now.getHours() < 9;
  const endOfDayVisible = now.getHours() >= 17;

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-5 pb-24">
      {(morningPlanningVisible || endOfDayVisible) && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {morningPlanningVisible && (
            <Button
              as="a"
              href="https://www.notion.so/showersfam/Good-Morning-193e7abcffbf8089a06ed63144d0d82d"
              target="_blank"
              rel="noreferrer"
              size="sm"
              variant="flat"
              className={flatButtonClass}
            >
              Morning Planning
            </Button>
          )}
          {endOfDayVisible && (
            <Button
              as="a"
              href="https://www.notion.so/showersfam/End-of-Day-Follow-ups-195e7abcffbf809380f1d2e391a60e3f"
              target="_blank"
              rel="noreferrer"
              size="sm"
              variant="flat"
              className={flatButtonClass}
            >
              End of Day Follow-ups
            </Button>
          )}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.45fr_0.95fr]">
        <section className="space-y-3">
          <div>
            <h2 className="text-[11px] font-mono uppercase tracking-[0.14em] text-zinc-500">Today’s Non-Negotiables</h2>
            <p className="mt-1 text-[13px] text-zinc-500">Only items dated today in Notion.</p>
          </div>
          <Card className="rounded-md border border-zinc-200 bg-white shadow-none dark:border-white/10 dark:bg-[#080808]">
            <CardBody className="gap-2 p-3">
              {todayLoading ? (
                <div className="flex justify-center py-4"><Spinner size="sm" /></div>
              ) : nonNegotiables.length === 0 ? (
                <p className="px-1 py-2 text-[13px] text-zinc-500">No non-negotiables for today.</p>
              ) : (
                nonNegotiables.map((item) => (
                  <label
                    key={item.id}
                    className="flex cursor-pointer items-center gap-3 rounded-sm border border-transparent px-2 py-2 hover:bg-zinc-50 dark:hover:bg-white/[0.03]"
                  >
                    <Checkbox
                      isSelected={item.completed}
                      onValueChange={async (checked) => {
                        setNonNegotiables((prev) =>
                          prev.map((entry) => (entry.id === item.id ? { ...entry, completed: checked } : entry))
                        );
                        try {
                          const updated = await api.updateTodayNonNegotiable(item.id, checked);
                          setNonNegotiables((prev) =>
                            prev.map((entry) => (entry.id === item.id ? updated : entry))
                          );
                        } catch {
                          setNonNegotiables((prev) =>
                            prev.map((entry) => (entry.id === item.id ? { ...entry, completed: !checked } : entry))
                          );
                        }
                      }}
                    />
                    <span className={`flex-1 text-[13px] ${item.completed ? "text-zinc-400 line-through" : "text-zinc-700 dark:text-zinc-200"}`}>
                      {item.title}
                    </span>
                  </label>
                ))
              )}
            </CardBody>
          </Card>
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-[11px] font-mono uppercase tracking-[0.14em] text-zinc-500">Today’s Model Usage</h2>
            <p className="mt-1 text-[13px] text-zinc-500">Tokens and cost by provider since local midnight.</p>
          </div>
          <Card className="rounded-md border border-zinc-200 bg-white shadow-none dark:border-white/10 dark:bg-[#080808]">
            <CardBody className="gap-3 p-4">
              {todayLoading ? (
                <div className="flex min-h-[180px] items-center justify-center"><Spinner size="sm" /></div>
              ) : usageByProvider.length === 0 ? (
                <p className="text-[13px] text-zinc-500">No usage logged yet today.</p>
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1">
                  {usageByProvider.map((row) => (
                    <div key={row.provider} className="rounded-sm border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-white/10 dark:bg-white/[0.03]">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] uppercase tracking-wide text-zinc-500">{row.provider}</span>
                        <span className="text-[12px] font-medium text-zinc-800 dark:text-zinc-100">{formatUsd(row.cost)}</span>
                      </div>
                      <p className="mt-1 text-[13px] text-zinc-600 dark:text-zinc-300">{formatCompactNumber(row.tokens)} tokens</p>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </section>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-[11px] font-mono uppercase tracking-[0.14em] text-zinc-500">Brain Channels</h2>
          <p className="mt-1 text-[13px] text-zinc-500">Currently airing notes, front and center.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {todayLoading ? (
            <Card className="col-span-2 rounded-md border border-zinc-200 bg-white shadow-none dark:border-white/10 dark:bg-[#080808] lg:col-span-4">
              <CardBody className="flex min-h-[180px] items-center justify-center p-4"><Spinner size="sm" /></CardBody>
            </Card>
          ) : brainChannels.length === 0 ? (
            <Card className="col-span-2 rounded-md border border-zinc-200 bg-white shadow-none dark:border-white/10 dark:bg-[#080808] lg:col-span-4">
              <CardBody className="p-4 text-[13px] text-zinc-500">No active brain channels.</CardBody>
            </Card>
          ) : (
            brainChannels.map((channel) => (
              <button
                key={channel.id}
                type="button"
                onClick={() => setSelectedBrainChannelId(channel.id)}
                className="group flex min-h-[184px] flex-col overflow-hidden rounded-md border border-zinc-200 bg-white text-left transition-colors hover:bg-zinc-50 dark:border-white/10 dark:bg-[#080808] dark:hover:bg-white/[0.03]"
              >
                <div className="relative h-20 w-full shrink-0 bg-zinc-100 dark:bg-white/[0.04] sm:h-24">
                  {channel.cover_url ? (
                    <img src={channel.cover_url} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="flex flex-1 flex-col justify-between gap-3 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="line-clamp-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">{channel.title}</h3>
                    {channel.source_url && (
                      <a
                        href={channel.source_url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(event) => event.stopPropagation()}
                        className="shrink-0 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                      >
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {channel.type && (
                      <Chip size="sm" variant="flat" className="h-5 whitespace-nowrap border border-zinc-200 bg-zinc-100 text-[10px] uppercase dark:border-white/10 dark:bg-white/5">
                        {channel.type}
                      </Chip>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.45fr_0.95fr]">
        <div className="space-y-4">
          <section className="space-y-3">
            <div>
              <h2 className="text-[11px] font-mono uppercase tracking-[0.14em] text-zinc-500">Notion Tasks</h2>
              <p className="mt-1 text-[13px] text-zinc-500">Scheduled today, plus unscheduled work due in the next 7 days.</p>
            </div>

            <Card className="rounded-md border border-zinc-200 bg-white shadow-none dark:border-white/10 dark:bg-[#080808]">
              <CardBody className="gap-3 p-4">
                <Input
                  value={newTaskTitle}
                  onValueChange={setNewTaskTitle}
                  placeholder="Create a new Notion task…"
                  variant="flat"
                  classNames={{
                    inputWrapper: "rounded-sm border border-zinc-200 bg-zinc-100 shadow-none dark:border-white/10 dark:bg-white/5",
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void handleCreateTask();
                    }
                  }}
                />
                <div className="grid gap-3 md:grid-cols-2">
                  <Input
                    type="date"
                    label="Scheduled"
                    labelPlacement="outside"
                    value={newTaskScheduledAt}
                    onValueChange={setNewTaskScheduledAt}
                    variant="flat"
                    classNames={{
                      inputWrapper: "rounded-sm border border-zinc-200 bg-zinc-100 shadow-none dark:border-white/10 dark:bg-white/5",
                    }}
                  />
                  <Input
                    type="date"
                    label="Due"
                    labelPlacement="outside"
                    value={newTaskDueAt}
                    onValueChange={setNewTaskDueAt}
                    variant="flat"
                    classNames={{
                      inputWrapper: "rounded-sm border border-zinc-200 bg-zinc-100 shadow-none dark:border-white/10 dark:bg-white/5",
                    }}
                  />
                </div>
                <Textarea
                  minRows={2}
                  value={newTaskNotes}
                  onValueChange={setNewTaskNotes}
                  placeholder="Optional notes..."
                  variant="flat"
                  classNames={{
                    inputWrapper: "rounded-sm border border-zinc-200 bg-zinc-100 shadow-none dark:border-white/10 dark:bg-white/5",
                  }}
                />
                <div className="flex justify-end">
                  <Button color="primary" className="min-w-[96px] rounded-sm" onPress={handleCreateTask} isLoading={creatingTask}>
                    Add
                  </Button>
                </div>
              </CardBody>
            </Card>

            <div className="space-y-4">
              {todayPersonalTasks.length === 0 ? (
                <Card className="rounded-md border border-zinc-200 bg-white shadow-none dark:border-white/10 dark:bg-[#080808]">
                  <CardBody className="p-4 text-[13px] text-zinc-500">No Notion tasks in today’s slice.</CardBody>
                </Card>
              ) : (
                <>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[11px] font-mono uppercase tracking-[0.14em] text-zinc-500">Open</h3>
                      <Chip size="sm" variant="flat" className="h-5 border border-zinc-200 bg-zinc-100 text-[10px] uppercase dark:border-white/10 dark:bg-white/5">
                        {openTodayPersonalTasks.length}
                      </Chip>
                    </div>
                    <div className="space-y-3">
                      {openTodayPersonalTasks.length === 0 ? (
                        <Card className="rounded-md border border-zinc-200 bg-white shadow-none dark:border-white/10 dark:bg-[#080808]">
                          <CardBody className="p-4 text-[13px] text-zinc-500">Nothing open in today’s Notion slice.</CardBody>
                        </Card>
                      ) : (
                        openTodayPersonalTasks.map((task) => {
                          const dueToday = isSameLocalDay(task.due_at, now);
                          const dueTomorrow = !dueToday && isDueTomorrow(task.due_at, now);

                          return (
                            <Card key={task.id} className="rounded-md border border-zinc-200 bg-white shadow-none dark:border-white/10 dark:bg-[#080808]">
                              <CardBody className="gap-3 p-4">
                                <div className="flex items-start gap-3">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{task.title}</h3>
                                      <Chip size="sm" variant="flat" color={statusChipColor(task.status)} className="h-5 whitespace-nowrap text-[10px] uppercase">
                                        {(task.source_status || task.status).replace("_", " ")}
                                      </Chip>
                                      {dueToday && (
                                        <Chip size="sm" variant="flat" color="danger" className="h-5 whitespace-nowrap text-[10px] uppercase">
                                          <span className="inline-flex items-center gap-1 whitespace-nowrap">
                                            <CalendarCheck size={12} />
                                            Due today
                                          </span>
                                        </Chip>
                                      )}
                                      {dueTomorrow && (
                                        <Chip size="sm" variant="flat" color="warning" className="h-5 whitespace-nowrap text-[10px] uppercase">
                                          <span className="inline-flex items-center gap-1 whitespace-nowrap">
                                            <TriangleAlert size={12} />
                                            Due tomorrow
                                          </span>
                                        </Chip>
                                      )}
                                    </div>
                                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-zinc-500">
                                      {task.scheduled_at && (
                                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                                          <Clock3 size={13} />
                                          Scheduled {formatScheduledLabel(task.scheduled_at)}
                                        </span>
                                      )}
                                      {task.due_at && (
                                        <span className={`inline-flex items-center gap-1.5 whitespace-nowrap ${dueToday ? "text-rose-600 dark:text-rose-400" : dueTomorrow ? "text-amber-600 dark:text-amber-400" : "text-zinc-500"}`}>
                                          {dueTomorrow ? <TriangleAlert size={13} /> : <AlertCircle size={13} />}
                                          Due {formatDueLabel(task.due_at, now)}
                                        </span>
                                      )}
                                    </div>
                                    {task.description && (
                                      <p className="mt-2 line-clamp-3 text-[13px] text-zinc-600 dark:text-zinc-300">
                                        {task.description}
                                      </p>
                                    )}
                                  </div>
                                  <div className="ml-auto flex shrink-0 flex-wrap justify-end gap-2 self-start">
                                    <Button
                                      size="sm"
                                      variant="flat"
                                      className={flatButtonClass}
                                      startContent={<Play size={14} />}
                                      onPress={() => void handleStartWork(task)}
                                      isLoading={startingTaskId === task.id}
                                    >
                                      Starting work
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="flat"
                                      className={flatButtonClass}
                                      startContent={<SquarePen size={14} />}
                                      onPress={() => setSelectedPersonalTaskId(task.id)}
                                    >
                                      Details
                                    </Button>
                                  </div>
                                </div>
                              </CardBody>
                            </Card>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[11px] font-mono uppercase tracking-[0.14em] text-zinc-500">Done</h3>
                      <Chip size="sm" variant="flat" className="h-5 border border-emerald-200 bg-emerald-50 text-[10px] uppercase text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                        {completedTodayPersonalTasks.length}
                      </Chip>
                    </div>
                    <div className="space-y-3">
                      {completedTodayPersonalTasks.length === 0 ? (
                        <Card className="rounded-md border border-zinc-200 bg-white shadow-none dark:border-white/10 dark:bg-[#080808]">
                          <CardBody className="p-4 text-[13px] text-zinc-500">No completed Notion tasks yet.</CardBody>
                        </Card>
                      ) : (
                        completedTodayPersonalTasks.map((task) => (
                          <Card key={task.id} className="rounded-md border border-emerald-200 bg-emerald-50/80 shadow-none dark:border-emerald-500/30 dark:bg-emerald-500/[0.08]">
                            <CardBody className="gap-3 p-4">
                              <div className="flex items-start gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="text-sm font-medium text-emerald-900 dark:text-emerald-100">{task.title}</h3>
                                    <Chip size="sm" variant="flat" color="success" className="h-5 whitespace-nowrap text-[10px] uppercase">
                                      {(task.source_status || task.status).replace("_", " ")}
                                    </Chip>
                                  </div>
                                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-emerald-700 dark:text-emerald-200">
                                    {task.scheduled_at && (
                                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                                        <Clock3 size={13} />
                                        Scheduled {formatScheduledLabel(task.scheduled_at)}
                                      </span>
                                    )}
                                    {task.due_at && (
                                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                                        <AlertCircle size={13} />
                                        Due {formatDueLabel(task.due_at, now)}
                                      </span>
                                    )}
                                  </div>
                                  {task.description && (
                                    <p className="mt-2 line-clamp-3 text-[13px] text-emerald-800/90 dark:text-emerald-100/85">
                                      {task.description}
                                    </p>
                                  )}
                                </div>
                                <div className="ml-auto flex shrink-0 flex-wrap justify-end gap-2 self-start">
                                  <Button
                                    size="sm"
                                    variant="flat"
                                    className={flatButtonClass}
                                    startContent={<SquarePen size={14} />}
                                    onPress={() => setSelectedPersonalTaskId(task.id)}
                                  >
                                    Details
                                  </Button>
                                </div>
                              </div>
                            </CardBody>
                          </Card>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>

          {/* Bee Insights */}
          <section className="space-y-3">
            <div>
              <h2 className="text-[11px] font-mono uppercase tracking-[0.14em] text-zinc-500">Bee Insights</h2>
              <p className="mt-1 text-[13px] text-zinc-500">Suggested actions captured from Bee. Add to Notion or dismiss.</p>
            </div>
            <div className="space-y-2">
              {beeInsightsLoading ? (
                <>
                  <BeeInsightSkeleton />
                  <BeeInsightSkeleton />
                </>
              ) : beeInsights.length === 0 ? (
                <div className="flex items-center justify-center rounded-md border border-dashed border-zinc-200 py-6 dark:border-white/10">
                  <p className="text-[13px] italic text-zinc-500 dark:text-gray-500">No new insights from Bee.</p>
                </div>
              ) : (
                beeInsights.map((insight) => (
                  <BeeInsightCard
                    key={insight.id}
                    insight={insight}
                    onAddToNotion={handleAddInsightToNotion}
                    onDismiss={handleDismissInsight}
                  />
                ))
              )}
            </div>
          </section>

        </div>

        <div className="space-y-4">
          <section className="space-y-3">
            <div>
              <h2 className="text-[11px] font-mono uppercase tracking-[0.14em] text-zinc-500">Team Tasks</h2>
              <p className="mt-1 text-[13px] text-zinc-500">Quieter by design: blocked work and recent completions only.</p>
            </div>
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-[11px] font-mono uppercase tracking-[0.14em] text-zinc-500">Blocked</h3>
                  <Chip size="sm" variant="flat" className="h-5 border border-zinc-200 bg-zinc-100 text-[10px] uppercase dark:border-white/10 dark:bg-white/5">
                    {blockedTasks.length}
                  </Chip>
                </div>
                <div className="space-y-3">
                  {blockedTasks.length === 0 ? (
                    <Card className="rounded-md border border-zinc-200 bg-white shadow-none dark:border-white/10 dark:bg-[#080808]">
                      <CardBody className="p-4 text-[13px] text-zinc-500">No blocked tasks right now.</CardBody>
                    </Card>
                  ) : (
                    blockedTasks.map((task) => <TeamTaskCard key={task.id} task={task} onOpen={setSelectedTask} />)
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-[11px] font-mono uppercase tracking-[0.14em] text-zinc-500">Recently Completed</h3>
                  <Chip size="sm" variant="flat" className="h-5 border border-zinc-200 bg-zinc-100 text-[10px] uppercase dark:border-white/10 dark:bg-white/5">
                    {recentCompletedTasks.length}
                  </Chip>
                </div>
                <div className="space-y-3">
                  {recentCompletedTasks.length === 0 ? (
                    <Card className="rounded-md border border-zinc-200 bg-white shadow-none dark:border-white/10 dark:bg-[#080808]">
                      <CardBody className="p-4 text-[13px] text-zinc-500">Nothing wrapped recently.</CardBody>
                    </Card>
                  ) : (
                    recentCompletedTasks.map((task) => <TeamTaskCard key={task.id} task={task} onOpen={setSelectedTask} />)
                  )}
                </div>
              </div>
            </div>
          </section>

        </div>
      </div>

      {selectedTask && (
        <TaskDrawer
          task={selectedTask}
          isOpen={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={(updated) => {
            setTasks((prev) => prev.map((task) => (task.id === updated.id ? updated : task)));
            setSelectedTask(updated);
          }}
        />
      )}

      {selectedPersonalTaskId && (
        <PersonalTaskDrawer
          taskId={selectedPersonalTaskId}
          isOpen={!!selectedPersonalTaskId}
          onClose={() => setSelectedPersonalTaskId(null)}
          onPromoted={() => {
            void refreshPersonalTasks();
            void refreshTeamTasks();
          }}
          onTaskUpdated={() => {
            void refreshPersonalTasks();
          }}
        />
      )}

      <BrainChannelDrawer
        channelId={selectedBrainChannelId}
        isOpen={!!selectedBrainChannelId}
        onClose={() => setSelectedBrainChannelId(null)}
        onSaved={(updated: BrainChannelDetail) => {
          setBrainChannels((prev) => prev.map((channel) => (channel.id === updated.id ? updated : channel)));
        }}
      />
    </div>
  );
}
