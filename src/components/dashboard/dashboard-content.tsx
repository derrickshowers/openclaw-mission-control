"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Button,
  Card,
  CardBody,
  Checkbox,
  Chip,
  Input,
  Spinner,
  Textarea,
} from "@heroui/react";
import {
  AlertCircle,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  ExternalLink,
  MessageSquare,
  Play,
  RefreshCw,
  SquarePen,
  TriangleAlert,
} from "lucide-react";
import { api, type BrainChannelDetail, type BrainChannelSummary, type PersonalTask, type Task, type TaskComment, type TodayNonNegotiable } from "@/lib/api";
import { formatLocal, parseUTC, timeAgo } from "@/lib/dates";
import { normalizeAgentId, resolveAgentAvatarUrl } from "@/lib/agents";
import { useSSE } from "@/hooks/use-sse";
import { TaskDrawer } from "@/components/tasks/task-drawer";
import { PersonalTaskDrawer } from "@/components/tasks/personal-task-drawer";
import { BrainChannelDrawer } from "./brain-channel-drawer";

interface DashboardContentProps {
  tasks: Task[];
  agents: any[];
  personalTasks: PersonalTask[];
}

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

function comparePersonalTasks(a: PersonalTask, b: PersonalTask) {
  const aScheduled = a.scheduled_at ? parseUTC(a.scheduled_at).getTime() : Number.POSITIVE_INFINITY;
  const bScheduled = b.scheduled_at ? parseUTC(b.scheduled_at).getTime() : Number.POSITIVE_INFINITY;
  const aDue = a.due_at ? parseUTC(a.due_at).getTime() : Number.POSITIVE_INFINITY;
  const bDue = b.due_at ? parseUTC(b.due_at).getTime() : Number.POSITIVE_INFINITY;

  if (aScheduled !== bScheduled) return aScheduled - bScheduled;
  if (aDue !== bDue) return aDue - bDue;
  return parseUTC(b.updated_at).getTime() - parseUTC(a.updated_at).getTime();
}

function isSameLocalDay(dateValue: string | null | undefined, target: Date) {
  if (!dateValue) return false;
  const d = parseUTC(dateValue);
  return (
    d.getFullYear() === target.getFullYear() &&
    d.getMonth() === target.getMonth() &&
    d.getDate() === target.getDate()
  );
}

function isWithinNextSevenDays(dateValue: string | null | undefined, now: Date) {
  if (!dateValue) return false;
  const d = parseUTC(dateValue);
  const start = startOfLocalDay(now).getTime();
  const end = addLocalDays(startOfLocalDay(now), 8).getTime();
  const value = d.getTime();
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

function roleForAgent(agentName?: string | null) {
  const id = normalizeAgentId(agentName);
  if (id === "frank") return "Orchestrator";
  if (id === "tom") return "Lead Architect";
  if (id === "michael") return "Engineer";
  if (id === "joanna") return "Product / UX";
  if (id === "elena") return "Platform";
  if (id === "derrick") return "Founder";
  return "Agent";
}

function statusChipColor(status: Task["status"] | PersonalTask["status"]) {
  if (status === "blocked") return "danger" as const;
  if (status === "in_progress") return "primary" as const;
  if (status === "done") return "success" as const;
  return "default" as const;
}

function commentSort(items: TaskComment[]) {
  return [...items].sort(
    (a, b) => parseUTC(b.created_at).getTime() - parseUTC(a.created_at).getTime()
  );
}

function TeamTaskCard({
  task,
  author,
  onOpen,
}: {
  task: Task;
  author: string;
  onOpen: (task: Task) => void;
}) {
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const { lastEvent } = useSSE(["comment.created"]);

  const loadComments = useCallback(() => {
    setLoading(true);
    api
      .getComments(task.id)
      .then((rows) => setComments(commentSort(rows)))
      .catch(() => setComments([]))
      .finally(() => setLoading(false));
  }, [task.id]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  useEffect(() => {
    if (!lastEvent || lastEvent.event !== "comment.created") return;
    if (lastEvent.data?.comment?.task_id !== task.id) return;
    setComments((prev) => {
      const next = lastEvent.data.comment as TaskComment;
      if (prev.some((comment) => comment.id === next.id)) return prev;
      return commentSort([next, ...prev]);
    });
  }, [lastEvent, task.id]);

  const handleSend = async () => {
    const content = reply.trim();
    if (!content) return;
    setSending(true);
    try {
      const created = await api.addComment(task.id, author, content);
      setComments((prev) => {
        if (prev.some((comment) => comment.id === created.id)) return prev;
        return commentSort([created, ...prev]);
      });
      setReply("");
    } finally {
      setSending(false);
    }
  };

  const blockedTone = task.status === "blocked"
    ? "border-l-2 border-l-amber-500 bg-amber-500/[0.06]"
    : "border-l-2 border-l-transparent";

  return (
    <Card className={`rounded-md border border-zinc-200 bg-white shadow-none dark:border-white/10 dark:bg-[#080808] ${blockedTone}`}>
      <CardBody className="gap-4 p-4">
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
              <p className="mt-2 line-clamp-3 text-[13px] text-zinc-600 dark:text-zinc-300">
                {task.description}
              </p>
            )}
          </div>
          <Button
            size="sm"
            variant="flat"
            className="rounded-sm border border-zinc-200 bg-zinc-100 text-zinc-800 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200"
            onPress={() => onOpen(task)}
          >
            Open
          </Button>
        </div>

        <div className="space-y-2 rounded-sm border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wide text-zinc-500">
              <MessageSquare size={13} />
              Comment thread
            </div>
            <button
              type="button"
              className="text-[11px] text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              onClick={loadComments}
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-4"><Spinner size="sm" /></div>
          ) : comments.length === 0 ? (
            <p className="text-[12px] text-zinc-500">No comments yet.</p>
          ) : (
            <div className="space-y-2">
              {comments.slice(0, 4).map((comment) => (
                <div key={comment.id} className="rounded-sm border border-zinc-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-[#0d0d0d]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-wide text-zinc-500">{comment.author}</span>
                    <span className="text-[10px] text-zinc-500">{timeAgo(comment.created_at)}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-zinc-700 dark:text-zinc-200">
                    {comment.content}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2 pt-1 sm:flex-row">
            <Textarea
              minRows={2}
              value={reply}
              onValueChange={setReply}
              placeholder="Reply right here…"
              variant="flat"
              className="flex-1"
              classNames={{
                inputWrapper: "rounded-sm border border-zinc-200 bg-white shadow-none dark:border-white/10 dark:bg-[#0d0d0d]",
                input: "text-[13px] text-zinc-800 dark:text-zinc-200",
              }}
            />
            <Button
              size="sm"
              color="primary"
              className="rounded-sm"
              onPress={handleSend}
              isLoading={sending}
            >
              Send
            </Button>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

export function DashboardContent({ tasks: initialTasks, agents, personalTasks: initialPersonalTasks }: DashboardContentProps) {
  const { data: session } = useSession();
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [personalTasks, setPersonalTasks] = useState<PersonalTask[]>(initialPersonalTasks);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedPersonalTaskId, setSelectedPersonalTaskId] = useState<string | null>(null);
  const [selectedBrainChannelId, setSelectedBrainChannelId] = useState<string | null>(null);
  const [nonNegotiables, setNonNegotiables] = useState<TodayNonNegotiable[]>([]);
  const [brainChannels, setBrainChannels] = useState<BrainChannelSummary[]>([]);
  const [usageByProvider, setUsageByProvider] = useState<Array<{ provider: string; tokens: number; cost: number }>>([]);
  const [todayLoading, setTodayLoading] = useState(true);
  const [creatingTask, setCreatingTask] = useState(false);
  const [startingTaskId, setStartingTaskId] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskScheduledAt, setNewTaskScheduledAt] = useState(toLocalDateKey(new Date()));
  const [newTaskDueAt, setNewTaskDueAt] = useState(nextFridayDateKey());
  const [newTaskNotes, setNewTaskNotes] = useState("");

  const viewer = useMemo(() => {
    const first = session?.user?.name?.split(" ")[0];
    return normalizeAgentId(first) || "derrick";
  }, [session?.user?.name]);

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

  const refreshTodayData = useCallback(async () => {
    const now = new Date();
    const today = toLocalDateKey(now);
    const start = startOfLocalDay(now).toISOString();
    const end = now.toISOString();

    setTodayLoading(true);
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
        const totalTokens = row.total_tokens !== undefined
          ? Number(row.total_tokens || 0)
          : Number(row.input_tokens || 0) + Number(row.cached_input_tokens || 0) + Number(row.output_tokens || 0);
        entry.tokens += totalTokens;
        entry.cost += Number(row.cost_usd || 0);
        grouped.set(provider, entry);
      }

      setUsageByProvider(Array.from(grouped.values()).sort((a, b) => b.cost - a.cost || b.tokens - a.tokens));
    } finally {
      setTodayLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshTodayData();
  }, [refreshTodayData]);

  useEffect(() => {
    const interval = setInterval(() => {
      void refreshTodayData();
      void refreshPersonalTasks();
      void refreshTeamTasks();
    }, 60_000);
    return () => clearInterval(interval);
  }, [refreshTodayData, refreshPersonalTasks, refreshTeamTasks]);

  const { lastEvent } = useSSE([
    "personal_task.updated",
    "personal_task.scheduled",
    "personal_task.promoted",
    "task.updated",
    "task.created",
    "task.deleted",
    "task.moved",
  ]);

  useEffect(() => {
    if (!lastEvent) return;
    if (String(lastEvent.event).startsWith("personal_task.")) {
      void refreshPersonalTasks();
    }
    if (String(lastEvent.event).startsWith("task.")) {
      void refreshTeamTasks();
    }
  }, [lastEvent, refreshPersonalTasks, refreshTeamTasks]);

  const now = new Date();
  const teamFocusTasks = useMemo(() => {
    return sortTasksByUpdatedDesc(
      tasks.filter((task) => (normalizeAgentId(task.assignee) === "derrick" && task.status !== "done") || (task.status === "blocked" && !!task.assignee))
    );
  }, [tasks]);

  const recentCompletedTasks = useMemo(() => {
    return sortTasksByUpdatedDesc(tasks.filter((task) => task.status === "done")).slice(0, 6);
  }, [tasks]);

  const todayPersonalTasks = useMemo(() => {
    return [...personalTasks]
      .filter((task) => isSameLocalDay(task.scheduled_at, now) || (!task.scheduled_at && isWithinNextSevenDays(task.due_at, now)))
      .sort(comparePersonalTasks);
  }, [personalTasks, now]);

  const teamPulse = useMemo(() => {
    return agents.map((agent: any) => {
      const id = normalizeAgentId(agent.name);
      const fallbackTask = teamFocusTasks.find((task) => normalizeAgentId(task.assignee) === id);
      return {
        ...agent,
        currentTask: agent.currentTask || fallbackTask || null,
      };
    });
  }, [agents, teamFocusTasks]);

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
    <div className="mx-auto flex max-w-[1280px] flex-col gap-4 pb-24">
      <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr]">
        <Card className="rounded-md border border-zinc-200 bg-white shadow-none dark:border-white/10 dark:bg-[#080808]">
          <CardBody className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-mono uppercase tracking-[0.14em] text-zinc-500">Today</p>
              <h1 className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">High-signal view for what matters now</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {morningPlanningVisible && (
                <Button
                  as="a"
                  href="https://www.notion.so/showersfam/Good-Morning-193e7abcffbf8089a06ed63144d0d82d"
                  target="_blank"
                  rel="noreferrer"
                  color="primary"
                  className="rounded-sm"
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
                  color="primary"
                  variant="flat"
                  className="rounded-sm border border-zinc-200 dark:border-white/10"
                >
                  End of Day Follow-ups
                </Button>
              )}
              <Button
                size="sm"
                variant="flat"
                className="rounded-sm border border-zinc-200 bg-zinc-100 dark:border-white/10 dark:bg-white/5"
                startContent={<RefreshCw size={14} />}
                onPress={() => {
                  void refreshTodayData();
                  void refreshPersonalTasks();
                  void refreshTeamTasks();
                }}
              >
                Refresh
              </Button>
            </div>
          </CardBody>
        </Card>

        <Card className="rounded-md border border-zinc-200 bg-white shadow-none dark:border-white/10 dark:bg-[#080808]">
          <CardBody className="gap-3 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-mono uppercase tracking-[0.14em] text-zinc-500">Today’s Model Usage</p>
                <p className="mt-1 text-[12px] text-zinc-500">Tokens and cost by provider since local midnight.</p>
              </div>
            </div>
            {todayLoading ? (
              <div className="flex justify-center py-4"><Spinner size="sm" /></div>
            ) : usageByProvider.length === 0 ? (
              <p className="text-[13px] text-zinc-500">No usage logged yet today.</p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.45fr_1fr]">
        <div className="space-y-4">
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[11px] font-mono uppercase tracking-[0.14em] text-zinc-500">Team Tasks</h2>
                <p className="mt-1 text-[13px] text-zinc-500">Assigned to Derrick or blocked anywhere on the team.</p>
              </div>
              <Chip size="sm" variant="flat" className="h-5 border border-zinc-200 bg-zinc-100 text-[10px] uppercase dark:border-white/10 dark:bg-white/5">
                {teamFocusTasks.length} active
              </Chip>
            </div>
            <div className="space-y-3">
              {teamFocusTasks.length === 0 ? (
                <Card className="rounded-md border border-zinc-200 bg-white shadow-none dark:border-white/10 dark:bg-[#080808]">
                  <CardBody className="p-4 text-[13px] text-zinc-500">No active team tasks to review.</CardBody>
                </Card>
              ) : (
                teamFocusTasks.map((task) => (
                  <TeamTaskCard key={task.id} task={task} author={viewer} onOpen={setSelectedTask} />
                ))
              )}
            </div>
          </section>

          <section className="space-y-3">
            <div>
              <h2 className="text-[11px] font-mono uppercase tracking-[0.14em] text-zinc-500">Recently Completed</h2>
              <p className="mt-1 text-[13px] text-zinc-500">Quick review of recently finished work and the associated comments.</p>
            </div>
            <div className="space-y-3">
              {recentCompletedTasks.length === 0 ? (
                <Card className="rounded-md border border-zinc-200 bg-white shadow-none dark:border-white/10 dark:bg-[#080808]">
                  <CardBody className="p-4 text-[13px] text-zinc-500">Nothing wrapped recently.</CardBody>
                </Card>
              ) : (
                recentCompletedTasks.map((task) => (
                  <TeamTaskCard key={task.id} task={task} author={viewer} onOpen={setSelectedTask} />
                ))
              )}
            </div>
          </section>

          <section className="space-y-3">
            <div>
              <h2 className="text-[11px] font-mono uppercase tracking-[0.14em] text-zinc-500">Notion Tasks</h2>
              <p className="mt-1 text-[13px] text-zinc-500">Scheduled today, plus unscheduled work due in the next 7 days.</p>
            </div>

            <Card className="rounded-md border border-zinc-200 bg-white shadow-none dark:border-white/10 dark:bg-[#080808]">
              <CardBody className="gap-3 p-4">
                <div className="grid gap-3 md:grid-cols-[1.3fr_160px_160px_auto]">
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
                  <div className="flex items-end">
                    <Button color="primary" className="w-full rounded-sm" onPress={handleCreateTask} isLoading={creatingTask}>
                      Add
                    </Button>
                  </div>
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
              </CardBody>
            </Card>

            <div className="space-y-3">
              {todayPersonalTasks.length === 0 ? (
                <Card className="rounded-md border border-zinc-200 bg-white shadow-none dark:border-white/10 dark:bg-[#080808]">
                  <CardBody className="p-4 text-[13px] text-zinc-500">No Notion tasks in today’s slice.</CardBody>
                </Card>
              ) : (
                todayPersonalTasks.map((task) => {
                  const dueToday = isSameLocalDay(task.due_at, now);
                  const dueTomorrow = !dueToday && isDueTomorrow(task.due_at, now);
                  return (
                    <Card key={task.id} className="rounded-md border border-zinc-200 bg-white shadow-none dark:border-white/10 dark:bg-[#080808]">
                      <CardBody className="gap-3 p-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{task.title}</h3>
                              <Chip size="sm" variant="flat" color={statusChipColor(task.status)} className="h-5 text-[10px] uppercase">
                                {(task.source_status || task.status).replace("_", " ")}
                              </Chip>
                              {dueToday && (
                                <Chip size="sm" variant="flat" color="primary" className="h-5 text-[10px] uppercase">
                                  <CalendarCheck size={12} className="mr-1" />
                                  Due today
                                </Chip>
                              )}
                              {dueTomorrow && (
                                <Chip size="sm" variant="flat" color="warning" className="h-5 text-[10px] uppercase">
                                  <TriangleAlert size={12} className="mr-1" />
                                  Due tomorrow
                                </Chip>
                              )}
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-zinc-500">
                              {task.scheduled_at && (
                                <span className="inline-flex items-center gap-1.5">
                                  <Clock3 size={13} />
                                  Scheduled {formatLocal(task.scheduled_at, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                                </span>
                              )}
                              {task.due_at && (
                                <span className="inline-flex items-center gap-1.5">
                                  {dueTomorrow ? <TriangleAlert size={13} /> : <AlertCircle size={13} />}
                                  Due {formatLocal(task.due_at, { month: "short", day: "numeric" })}
                                </span>
                              )}
                            </div>
                            {task.description && (
                              <p className="mt-2 line-clamp-3 text-[13px] text-zinc-600 dark:text-zinc-300">
                                {task.description}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              size="sm"
                              variant="flat"
                              className="rounded-sm border border-zinc-200 bg-zinc-100 text-zinc-800 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200"
                              startContent={<Play size={14} />}
                              onPress={() => void handleStartWork(task)}
                              isLoading={startingTaskId === task.id}
                            >
                              Starting work
                            </Button>
                            <Button
                              size="sm"
                              variant="flat"
                              className="rounded-sm border border-zinc-200 bg-zinc-100 text-zinc-800 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200"
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
          </section>
        </div>

        <div className="space-y-4">
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
                          setNonNegotiables((prev) => prev.map((entry) => entry.id === item.id ? { ...entry, completed: checked } : entry));
                          try {
                            const updated = await api.updateTodayNonNegotiable(item.id, checked);
                            setNonNegotiables((prev) => prev.map((entry) => entry.id === item.id ? updated : entry));
                          } catch {
                            setNonNegotiables((prev) => prev.map((entry) => entry.id === item.id ? { ...entry, completed: !checked } : entry));
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
              <h2 className="text-[11px] font-mono uppercase tracking-[0.14em] text-zinc-500">Brain Channels</h2>
              <p className="mt-1 text-[13px] text-zinc-500">Currently airing notes, straight from Notion.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              {todayLoading ? (
                <Card className="rounded-md border border-zinc-200 bg-white shadow-none dark:border-white/10 dark:bg-[#080808]"><CardBody className="p-4"><Spinner size="sm" /></CardBody></Card>
              ) : brainChannels.length === 0 ? (
                <Card className="rounded-md border border-zinc-200 bg-white shadow-none dark:border-white/10 dark:bg-[#080808]"><CardBody className="p-4 text-[13px] text-zinc-500">No active brain channels.</CardBody></Card>
              ) : (
                brainChannels.map((channel) => (
                  <button
                    key={channel.id}
                    type="button"
                    onClick={() => setSelectedBrainChannelId(channel.id)}
                    className="overflow-hidden rounded-md border border-zinc-200 bg-white text-left transition-colors hover:bg-zinc-50 dark:border-white/10 dark:bg-[#080808] dark:hover:bg-white/[0.03]"
                  >
                    {channel.cover_url && (
                      <img src={channel.cover_url} alt="" className="h-20 w-full object-cover" />
                    )}
                    <div className="space-y-2 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{channel.title}</h3>
                        {channel.source_url && (
                          <a
                            href={channel.source_url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(event) => event.stopPropagation()}
                            className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                          >
                            <ExternalLink size={14} />
                          </a>
                        )}
                      </div>
                      {channel.type && (
                        <Chip size="sm" variant="flat" className="h-5 border border-zinc-200 bg-zinc-100 text-[10px] uppercase dark:border-white/10 dark:bg-white/5">
                          {channel.type}
                        </Chip>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </section>

          <section className="space-y-3">
            <div>
              <h2 className="text-[11px] font-mono uppercase tracking-[0.14em] text-zinc-500">Team Pulse</h2>
              <p className="mt-1 text-[13px] text-zinc-500">Who’s carrying what right now.</p>
            </div>
            <Card className="rounded-md border border-zinc-200 bg-white shadow-none dark:border-white/10 dark:bg-[#080808]">
              <CardBody className="gap-2 p-3">
                {teamPulse.map((agent: any) => {
                  const avatar = resolveAgentAvatarUrl(agent.name, agent.avatarUrl);
                  return (
                    <div key={agent.name} className="flex items-center gap-3 rounded-sm px-1 py-2">
                      {avatar ? (
                        <img src={avatar} alt={agent.name} className="h-8 w-8 rounded-full object-cover" />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-zinc-200 dark:bg-white/10" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium capitalize text-zinc-900 dark:text-zinc-100">{agent.name}</span>
                          <span className="text-[10px] font-mono uppercase tracking-wide text-zinc-500">{roleForAgent(agent.name)}</span>
                        </div>
                        <p className="truncate text-[12px] text-zinc-500">
                          {agent.currentTask ? agent.currentTask.title : "No task in this slice"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </CardBody>
            </Card>
          </section>
        </div>
      </div>

      {selectedTask && (
        <TaskDrawer
          task={selectedTask}
          isOpen={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={(updated) => {
            setTasks((prev) => prev.map((task) => task.id === updated.id ? updated : task));
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
          setBrainChannels((prev) => prev.map((channel) => channel.id === updated.id ? updated : channel));
        }}
      />
    </div>
  );
}
