"use client";

import { useState, useEffect, useCallback, useMemo, useRef, type CSSProperties } from "react";
import { Button } from "@heroui/react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isToday,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  startOfWeek as getWeekStart,
  endOfWeek as getWeekEnd,
  parseISO,
  startOfDay,
  endOfDay,
  differenceInCalendarDays,
  isValid,
} from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Repeat,
  X,
  ListTodo,
  Loader2,
} from "lucide-react";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { api, type PersonalTask } from "@/lib/api";

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start_date: string;
  end_date?: string;
  all_day: number;
  recurrence?: string;
  category: string;
  color?: string;
  created_by?: string;
}

type ViewMode = "month" | "week";

type TimeGridItem = {
  id: string;
  sourceId: string;
  title: string;
  kind: "event" | "notion";
  startMinute: number;
  durationMinutes: number;
  event?: CalendarEvent;
  task?: PersonalTask;
  syncing?: boolean;
  hasError?: boolean;
};

type PositionedTimeGridItem = TimeGridItem & {
  laneIndex: number;
  laneCount: number;
};

type DragPreview = {
  taskId: string;
  dayIndex: number;
  startMinute: number;
  durationMinutes: number;
};

type ResizeEdge = "start" | "end";

type ActiveResize = {
  taskId: string;
  dayIndex: number;
  edge: ResizeEdge;
  originClientY: number;
  originStartMinute: number;
  originDurationMinutes: number;
  originScrollTop: number;
};

const CATEGORY_COLORS: Record<string, string> = {
  cron: "#6366f1",
  standup: "#06b6d4",
  meeting: "#8b5cf6",
  deadline: "#ef4444",
  event: "#64748b",
};

const HOURS_IN_DAY = 24;
const HOUR_ROW_HEIGHT = 56;
const SNAP_MINUTES = 15;
const DEFAULT_EVENT_MINUTES = 60;
const DEFAULT_NOTION_TASK_MINUTES = 45;
const MIN_CARD_HEIGHT = 22;
const DAY_HEIGHT = HOURS_IN_DAY * HOUR_ROW_HEIGHT;
const HOURS = Array.from({ length: HOURS_IN_DAY }, (_, i) => i);

function hourLabel(hour: number): string {
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}${suffix}`;
}

function minuteToPixels(minutes: number): number {
  return (minutes / 60) * HOUR_ROW_HEIGHT;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function snapMinutes(minutes: number): number {
  return Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES;
}

function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function parseDateWithDefaultTime(raw: string, fallbackHour: number): Date | null {
  if (!raw) return null;

  const withTime = raw.includes("T") ? raw : `${raw}T${String(fallbackHour).padStart(2, "0")}:00:00`;
  const parsed = parseISO(withTime);
  return isValid(parsed) ? parsed : null;
}

function durationFromDates(start: Date, endRaw?: string): number {
  if (!endRaw) return DEFAULT_EVENT_MINUTES;
  const parsedEnd = parseDateWithDefaultTime(endRaw, start.getHours() + 1);
  if (!parsedEnd) return DEFAULT_EVENT_MINUTES;

  const minutes = Math.round((parsedEnd.getTime() - start.getTime()) / 60000);
  return clamp(minutes, SNAP_MINUTES, 12 * 60);
}

function parseDraggedTaskId(rawId: string | number): string | null {
  const id = String(rawId);
  if (!id.startsWith("notion-")) return null;
  return id.slice("notion-".length);
}

function getTaskDurationMinutes(task: PersonalTask): number {
  const startRaw = task.scheduled_at;
  if (!startRaw) return DEFAULT_NOTION_TASK_MINUTES;

  const start = parseISO(startRaw);
  if (!isValid(start)) return DEFAULT_NOTION_TASK_MINUTES;

  if (!task.scheduled_end_at) return DEFAULT_NOTION_TASK_MINUTES;

  const end = parseISO(task.scheduled_end_at);
  if (!isValid(end) || end <= start) return DEFAULT_NOTION_TASK_MINUTES;

  const minutes = Math.round((end.getTime() - start.getTime()) / 60000);
  return clamp(minutes, SNAP_MINUTES, 12 * 60);
}

function applyOverlapLayout(items: TimeGridItem[]): PositionedTimeGridItem[] {
  if (items.length <= 1) {
    return items.map((item) => ({ ...item, laneIndex: 0, laneCount: 1 }));
  }

  const sorted = [...items].sort((a, b) => {
    if (a.startMinute !== b.startMinute) return a.startMinute - b.startMinute;
    return b.durationMinutes - a.durationMinutes;
  });

  const layoutById = new Map<string, { laneIndex: number; laneCount: number }>();
  let cursor = 0;

  while (cursor < sorted.length) {
    const cluster: TimeGridItem[] = [sorted[cursor]];
    let clusterEnd = sorted[cursor].startMinute + sorted[cursor].durationMinutes;
    let next = cursor + 1;

    while (next < sorted.length && sorted[next].startMinute < clusterEnd) {
      cluster.push(sorted[next]);
      clusterEnd = Math.max(clusterEnd, sorted[next].startMinute + sorted[next].durationMinutes);
      next += 1;
    }

    const laneEnds: number[] = [];
    for (const item of cluster) {
      let laneIndex = laneEnds.findIndex((endMinute) => endMinute <= item.startMinute);
      if (laneIndex === -1) {
        laneIndex = laneEnds.length;
        laneEnds.push(0);
      }
      laneEnds[laneIndex] = item.startMinute + item.durationMinutes;
      layoutById.set(item.id, { laneIndex, laneCount: 0 });
    }

    const laneCount = Math.max(1, laneEnds.length);
    for (const item of cluster) {
      const lane = layoutById.get(item.id);
      if (lane) {
        lane.laneCount = laneCount;
      }
    }

    cursor = next;
  }

  return sorted.map((item) => {
    const lane = layoutById.get(item.id) ?? { laneIndex: 0, laneCount: 1 };
    return {
      ...item,
      laneIndex: lane.laneIndex,
      laneCount: lane.laneCount,
    };
  });
}

function positionedItemStyle(item: PositionedTimeGridItem, top: number, height: number): CSSProperties {
  const laneCount = Math.max(1, item.laneCount);
  const laneWidthPercent = 100 / laneCount;
  const leftPercent = laneWidthPercent * item.laneIndex;
  const rightPercent = 100 - laneWidthPercent * (item.laneIndex + 1);

  return {
    top,
    height,
    left: `calc(${leftPercent}% + 4px)`,
    right: `calc(${rightPercent}% + 4px)`,
  };
}

export function CalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [notionTasks, setNotionTasks] = useState<PersonalTask[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeDragTaskId, setActiveDragTaskId] = useState<string | null>(null);
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const [activeResize, setActiveResize] = useState<ActiveResize | null>(null);
  const [resizePreview, setResizePreview] = useState<DragPreview | null>(null);
  const [now, setNow] = useState(new Date());
  const [syncingTaskIds, setSyncingTaskIds] = useState<Set<string>>(new Set());
  const [errorTaskIds, setErrorTaskIds] = useState<Set<string>>(new Set());

  const dayColumnRefs = useRef<(HTMLDivElement | null)[]>([]);
  const weekScrollRef = useRef<HTMLDivElement | null>(null);
  const dragAnchorOffsetRef = useRef<number>(minuteToPixels(DEFAULT_NOTION_TASK_MINUTES) / 2);
  const resizePreviewRef = useRef<DragPreview | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 },
    })
  );

  const calendarDays = useMemo(() => {
    if (viewMode === "month") {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
      const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
      return eachDayOfInterval({ start: calStart, end: calEnd });
    }

    const weekStart = getWeekStart(currentDate, { weekStartsOn: 0 });
    const weekEnd = getWeekEnd(currentDate, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: weekStart, end: weekEnd });
  }, [currentDate, viewMode]);

  const weekStart = calendarDays[0];
  const weekEnd = calendarDays[6];
  const weekStartKey = weekStart ? format(weekStart, "yyyy-MM-dd") : "";

  const fetchCalendarData = useCallback(async () => {
    if (!calendarDays.length) return;

    setLoading(true);
    try {
      const start = format(calendarDays[0], "yyyy-MM-dd");
      const end = format(calendarDays[calendarDays.length - 1], "yyyy-MM-dd");

      const [eventsRes, personalTasksRes] = await Promise.all([
        fetch(`/api/mc/events?start=${start}&end=${end}`),
        api.getPersonalTasks({
          include_archived: false,
          sort: "updated",
          limit: 500,
        }),
      ]);

      const eventsData = await eventsRes.json().catch(() => []);
      setEvents(Array.isArray(eventsData) ? eventsData : []);
      setNotionTasks(Array.isArray(personalTasksRes) ? personalTasksRes : []);
    } catch {
      setEvents([]);
      setNotionTasks([]);
    } finally {
      setLoading(false);
    }
  }, [calendarDays]);

  useEffect(() => {
    fetchCalendarData();
  }, [fetchCalendarData]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    resizePreviewRef.current = resizePreview;
  }, [resizePreview]);

  useEffect(() => {
    if (viewMode !== "week" || !weekScrollRef.current) return;

    const currentMinutes = minutesOfDay(new Date());
    const targetTop = Math.max(0, minuteToPixels(currentMinutes) - 220);
    weekScrollRef.current.scrollTop = targetTop;
  }, [viewMode, weekStartKey]);

  const navigate = (direction: "prev" | "next") => {
    if (viewMode === "month") {
      setCurrentDate((d) => (direction === "next" ? addMonths(d, 1) : subMonths(d, 1)));
      return;
    }

    setCurrentDate((d) => (direction === "next" ? addWeeks(d, 1) : subWeeks(d, 1)));
  };

  const goToday = () => setCurrentDate(new Date());

  const getEventsForDay = (day: Date): CalendarEvent[] => {
    const dayStr = format(day, "yyyy-MM-dd");
    return events.filter((e) => e.start_date.startsWith(dayStr));
  };

  const weekItems = useMemo(() => {
    const byDay = Array.from({ length: 7 }, () => [] as TimeGridItem[]);
    if (viewMode !== "week" || !weekStart || !weekEnd) {
      return byDay.map((dayItems) => applyOverlapLayout(dayItems));
    }

    const weekStartBoundary = startOfDay(weekStart);
    const weekEndBoundary = endOfDay(weekEnd);

    for (const event of events) {
      const startDate = parseDateWithDefaultTime(event.start_date, event.all_day ? 9 : 9);
      if (!startDate) continue;

      if (startDate < weekStartBoundary || startDate > weekEndBoundary) continue;

      const dayIndex = differenceInCalendarDays(startOfDay(startDate), weekStartBoundary);
      if (dayIndex < 0 || dayIndex > 6) continue;

      const durationMinutes = durationFromDates(startDate, event.end_date);
      const startMinute = clamp(minutesOfDay(startDate), 0, 24 * 60 - durationMinutes);

      byDay[dayIndex].push({
        id: `event-${event.id}`,
        sourceId: event.id,
        title: event.title,
        kind: "event",
        startMinute,
        durationMinutes,
        event,
      });
    }

    for (const task of notionTasks) {
      if (!task.scheduled_at || task.status === "done") continue;

      const scheduledAt = parseISO(task.scheduled_at);
      if (!isValid(scheduledAt)) continue;
      if (scheduledAt < weekStartBoundary || scheduledAt > weekEndBoundary) continue;

      const dayIndex = differenceInCalendarDays(startOfDay(scheduledAt), weekStartBoundary);
      if (dayIndex < 0 || dayIndex > 6) continue;

      const durationMinutes = getTaskDurationMinutes(task);
      const startMinute = clamp(minutesOfDay(scheduledAt), 0, 24 * 60 - durationMinutes);

      byDay[dayIndex].push({
        id: `notion-${task.id}`,
        sourceId: task.id,
        title: task.title,
        kind: "notion",
        startMinute,
        durationMinutes,
        task,
        syncing: syncingTaskIds.has(task.id),
        hasError: errorTaskIds.has(task.id),
      });
    }

    return byDay.map((dayItems) => applyOverlapLayout(dayItems));
  }, [events, notionTasks, syncingTaskIds, errorTaskIds, viewMode, weekStart, weekEnd]);

  const buildDragPreview = useCallback(
    (taskId: string, dayIndex: number, translatedTop?: number): DragPreview | null => {
      const column = dayColumnRefs.current[dayIndex];
      if (!column) return null;

      const task = notionTasks.find((t) => t.id === taskId);
      if (!task) return null;

      const durationMinutes = getTaskDurationMinutes(task);
      const bounds = column.getBoundingClientRect();
      const currentScrollTop = weekScrollRef.current?.scrollTop ?? 0;
      const topY = translatedTop ?? bounds.top + minuteToPixels(12) - dragAnchorOffsetRef.current;
      const relativeY = topY - bounds.top + currentScrollTop;

      const rawMinutes = (relativeY / HOUR_ROW_HEIGHT) * 60;
      const snapped = snapMinutes(rawMinutes);
      const clamped = clamp(snapped, 0, 24 * 60 - durationMinutes);

      return {
        taskId,
        dayIndex,
        startMinute: clamped,
        durationMinutes,
      };
    },
    [notionTasks]
  );

  const persistTaskSchedule = useCallback(
    async (args: {
      taskId: string;
      nextStartIso: string | null;
      nextEndIso: string | null;
      previousStartIso: string | null;
      previousEndIso: string | null;
    }) => {
      const { taskId, nextStartIso, nextEndIso, previousStartIso, previousEndIso } = args;

      setNotionTasks((prev) =>
        prev.map((entry) =>
          entry.id === taskId
            ? { ...entry, scheduled_at: nextStartIso, scheduled_end_at: nextEndIso }
            : entry
        )
      );

      setSyncingTaskIds((prev) => {
        const next = new Set(prev);
        next.add(taskId);
        return next;
      });

      try {
        await api.schedulePersonalTask(taskId, {
          scheduled_at: nextStartIso,
          scheduled_end_at: nextEndIso,
        });
      } catch {
        setNotionTasks((prev) =>
          prev.map((entry) =>
            entry.id === taskId
              ? { ...entry, scheduled_at: previousStartIso, scheduled_end_at: previousEndIso }
              : entry
          )
        );

        setErrorTaskIds((prev) => {
          const next = new Set(prev);
          next.add(taskId);
          return next;
        });

        window.setTimeout(() => {
          setErrorTaskIds((prev) => {
            const next = new Set(prev);
            next.delete(taskId);
            return next;
          });
        }, 900);
      } finally {
        setSyncingTaskIds((prev) => {
          const next = new Set(prev);
          next.delete(taskId);
          return next;
        });
      }
    },
    []
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const taskId = parseDraggedTaskId(event.active.id);
      if (!taskId || activeResize) return;

      setResizePreview(null);
      setActiveDragTaskId(taskId);

      const currentTask = notionTasks.find((task) => task.id === taskId);
      if (!currentTask?.scheduled_at || !weekStart) return;

      const activator = event.activatorEvent as any;
      const pointerClientY =
        typeof activator?.clientY === "number"
          ? activator.clientY
          : activator?.touches?.length
            ? activator.touches[0]?.clientY
            : null;
      const initialTop = event.active.rect.current.initial?.top ?? event.active.rect.current.translated?.top;
      if (typeof pointerClientY === "number" && typeof initialTop === "number") {
        dragAnchorOffsetRef.current = pointerClientY - initialTop;
      }

      const scheduledAt = parseISO(currentTask.scheduled_at);
      if (!isValid(scheduledAt)) return;

      const dayIndex = differenceInCalendarDays(startOfDay(scheduledAt), startOfDay(weekStart));
      if (dayIndex < 0 || dayIndex > 6) return;

      setDragPreview({
        taskId,
        dayIndex,
        startMinute: snapMinutes(minutesOfDay(scheduledAt)),
        durationMinutes: getTaskDurationMinutes(currentTask),
      });
    },
    [activeResize, notionTasks, weekStart]
  );

  const handleDragMove = useCallback(
    (event: DragMoveEvent) => {
      const taskId = parseDraggedTaskId(event.active.id);
      if (!taskId || activeResize) return;

      const collisionId = event.collisions?.[0]?.id ? String(event.collisions[0].id) : "";
      if (!collisionId.startsWith("day-")) return;

      const dayIndex = Number(collisionId.replace("day-", ""));
      if (Number.isNaN(dayIndex) || dayIndex < 0 || dayIndex > 6) return;

      const translated = event.active.rect.current.translated;
      const preview = buildDragPreview(taskId, dayIndex, translated?.top);
      if (preview) {
        setDragPreview(preview);
      }
    },
    [activeResize, buildDragPreview]
  );

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const taskId = parseDraggedTaskId(event.active.id);
      if (!taskId || activeResize) return;

      const overId = event.over?.id ? String(event.over.id) : "";
      if (!overId.startsWith("day-")) {
        setDragPreview(null);
        return;
      }

      const dayIndex = Number(overId.replace("day-", ""));
      if (Number.isNaN(dayIndex) || dayIndex < 0 || dayIndex > 6) return;

      const translated = event.active.rect.current.translated;
      const preview = buildDragPreview(taskId, dayIndex, translated?.top);

      if (preview) {
        setDragPreview(preview);
      }
    },
    [activeResize, buildDragPreview]
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const taskId = parseDraggedTaskId(event.active.id);
      const nextPreview = dragPreview;

      setActiveDragTaskId(null);
      setDragPreview(null);

      if (!taskId || !nextPreview) return;

      const task = notionTasks.find((t) => t.id === taskId);
      if (!task) return;

      const targetDay = calendarDays[nextPreview.dayIndex];
      if (!targetDay) return;

      const nextScheduledAt = new Date(targetDay);
      nextScheduledAt.setHours(0, nextPreview.startMinute, 0, 0);
      const nextEndAt = new Date(nextScheduledAt.getTime() + nextPreview.durationMinutes * 60_000);

      const nextStartIso = nextScheduledAt.toISOString();
      const nextEndIso = nextEndAt.toISOString();
      const previousStartIso = task.scheduled_at ?? null;
      const previousEndIso = task.scheduled_end_at ?? null;

      if (previousStartIso === nextStartIso && previousEndIso === nextEndIso) {
        return;
      }

      await persistTaskSchedule({
        taskId,
        nextStartIso,
        nextEndIso,
        previousStartIso,
        previousEndIso,
      });
    },
    [calendarDays, dragPreview, notionTasks, persistTaskSchedule]
  );

  const handleDragCancel = useCallback(() => {
    setActiveDragTaskId(null);
    setDragPreview(null);
  }, []);

  const computeResizePreview = useCallback(
    (resizeState: ActiveResize, clientY: number): DragPreview => {
      const currentScrollTop = weekScrollRef.current?.scrollTop ?? resizeState.originScrollTop;
      const scrollDelta = currentScrollTop - resizeState.originScrollTop;
      const deltaMinutes = snapMinutes(((clientY - resizeState.originClientY + scrollDelta) / HOUR_ROW_HEIGHT) * 60);

      if (resizeState.edge === "end") {
        const durationMinutes = clamp(
          resizeState.originDurationMinutes + deltaMinutes,
          SNAP_MINUTES,
          24 * 60 - resizeState.originStartMinute
        );
        return {
          taskId: resizeState.taskId,
          dayIndex: resizeState.dayIndex,
          startMinute: resizeState.originStartMinute,
          durationMinutes,
        };
      }

      const maxStartMinute = resizeState.originStartMinute + resizeState.originDurationMinutes - SNAP_MINUTES;
      const startMinute = clamp(resizeState.originStartMinute + deltaMinutes, 0, maxStartMinute);
      const durationMinutes = resizeState.originDurationMinutes - (startMinute - resizeState.originStartMinute);

      return {
        taskId: resizeState.taskId,
        dayIndex: resizeState.dayIndex,
        startMinute,
        durationMinutes,
      };
    },
    []
  );

  const handleResizeStart = useCallback(
    (args: { taskId: string; dayIndex: number; edge: ResizeEdge; clientY: number }) => {
      const task = notionTasks.find((entry) => entry.id === args.taskId);
      if (!task?.scheduled_at || !weekStart) return;

      const scheduledAt = parseISO(task.scheduled_at);
      if (!isValid(scheduledAt)) return;

      const computedDayIndex = differenceInCalendarDays(startOfDay(scheduledAt), startOfDay(weekStart));
      const dayIndex = computedDayIndex >= 0 && computedDayIndex <= 6 ? computedDayIndex : args.dayIndex;
      if (dayIndex < 0 || dayIndex > 6) return;

      const durationMinutes = getTaskDurationMinutes(task);
      const startMinute = clamp(minutesOfDay(scheduledAt), 0, 24 * 60 - durationMinutes);

      setActiveDragTaskId(null);
      setDragPreview(null);

      const nextResize: ActiveResize = {
        taskId: args.taskId,
        dayIndex,
        edge: args.edge,
        originClientY: args.clientY,
        originStartMinute: startMinute,
        originDurationMinutes: durationMinutes,
        originScrollTop: weekScrollRef.current?.scrollTop ?? 0,
      };

      setActiveResize(nextResize);
      setResizePreview({
        taskId: args.taskId,
        dayIndex,
        startMinute,
        durationMinutes,
      });
    },
    [notionTasks, weekStart]
  );

  useEffect(() => {
    if (!activeResize) return;

    const handlePointerMove = (event: PointerEvent) => {
      setResizePreview(computeResizePreview(activeResize, event.clientY));
    };

    const handlePointerUp = () => {
      const finalPreview = resizePreviewRef.current ?? {
        taskId: activeResize.taskId,
        dayIndex: activeResize.dayIndex,
        startMinute: activeResize.originStartMinute,
        durationMinutes: activeResize.originDurationMinutes,
      };

      setActiveResize(null);
      setResizePreview(null);

      const task = notionTasks.find((entry) => entry.id === activeResize.taskId);
      const targetDay = calendarDays[finalPreview.dayIndex];
      if (!task || !targetDay) return;

      const nextStart = new Date(targetDay);
      nextStart.setHours(0, finalPreview.startMinute, 0, 0);
      const nextEnd = new Date(nextStart.getTime() + finalPreview.durationMinutes * 60_000);

      const nextStartIso = nextStart.toISOString();
      const nextEndIso = nextEnd.toISOString();
      const previousStartIso = task.scheduled_at ?? null;
      const previousEndIso = task.scheduled_end_at ?? null;

      if (previousStartIso === nextStartIso && previousEndIso === nextEndIso) {
        return;
      }

      void persistTaskSchedule({
        taskId: activeResize.taskId,
        nextStartIso,
        nextEndIso,
        previousStartIso,
        previousEndIso,
      });
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [activeResize, calendarDays, computeResizePreview, notionTasks, persistTaskSchedule]);

  const nowTop = minuteToPixels(minutesOfDay(now));

  return (
    <div className="mx-auto flex h-full max-w-[1440px] flex-col">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">
            {viewMode === "month"
              ? format(currentDate, "MMMM yyyy")
              : `Week of ${format(calendarDays[0], "MMM d")} – ${format(calendarDays[6], "MMM d, yyyy")}`}
          </h2>
          {loading && <span className="text-xs text-foreground-500">Loading…</span>}
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="flat"
            className="border border-gray-200 bg-white text-xs text-foreground-700 hover:bg-gray-50 dark:border-[#222222] dark:bg-[#080808] dark:text-[#EDEDED] dark:hover:bg-[#111111]"
            onPress={goToday}
          >
            Today
          </Button>

          <div className="flex">
            <Button
              size="sm"
              variant="flat"
              isIconOnly
              className="rounded-r-none border border-gray-200 bg-white text-foreground-600 hover:bg-gray-50 dark:border-[#222222] dark:bg-[#080808] dark:text-[#CCCCCC] dark:hover:bg-[#111111]"
              onPress={() => navigate("prev")}
            >
              <ChevronLeft size={14} strokeWidth={1.5} />
            </Button>
            <Button
              size="sm"
              variant="flat"
              isIconOnly
              className="rounded-l-none border border-gray-200 border-l-0 bg-white text-foreground-600 hover:bg-gray-50 dark:border-[#222222] dark:bg-[#080808] dark:text-[#CCCCCC] dark:hover:bg-[#111111]"
              onPress={() => navigate("next")}
            >
              <ChevronRight size={14} strokeWidth={1.5} />
            </Button>
          </div>

          <div className="ml-2 flex">
            <Button
              size="sm"
              variant="flat"
              className={`rounded-r-none border border-gray-200 text-xs dark:border-[#222222] ${
                viewMode === "month"
                  ? "bg-primary/10 text-primary border-primary/40 dark:bg-[#1A1A1A] dark:text-white dark:border-[#333333]"
                  : "bg-white text-foreground-500 hover:bg-gray-50 dark:bg-[#080808] dark:text-[#888888] dark:hover:bg-[#111111]"
              }`}
              onPress={() => setViewMode("month")}
            >
              Month
            </Button>
            <Button
              size="sm"
              variant="flat"
              className={`rounded-l-none border border-gray-200 border-l-0 text-xs dark:border-[#222222] ${
                viewMode === "week"
                  ? "bg-primary/10 text-primary border-primary/40 dark:bg-[#1A1A1A] dark:text-white dark:border-[#333333]"
                  : "bg-white text-foreground-500 hover:bg-gray-50 dark:bg-[#080808] dark:text-[#888888] dark:hover:bg-[#111111]"
              }`}
              onPress={() => setViewMode("week")}
            >
              Week
            </Button>
          </div>
        </div>
      </div>

      {viewMode === "week" ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-gray-200 bg-white dark:border-[#222222] dark:bg-[#0A0A0A]">
          <div className="grid grid-cols-[72px_repeat(7,minmax(140px,1fr))] border-b border-gray-200 dark:border-[#222222]">
            <div className="border-r border-gray-200 px-2 py-2 text-right text-[11px] font-mono text-foreground-400 dark:border-[#222222]">
              HRS
            </div>
            {calendarDays.map((day) => {
              const today = isToday(day);
              return (
                <div
                  key={day.toISOString()}
                  className="border-r border-gray-200 px-2 py-2 last:border-r-0 dark:border-[#222222]"
                >
                  <div className="text-[11px] font-mono uppercase tracking-wide text-foreground-500">
                    {format(day, "EEE")}
                  </div>
                  <div
                    className={`mt-1 inline-flex rounded-sm px-2 py-1 text-sm ${
                      today
                        ? "bg-black/5 font-semibold text-foreground-900 dark:bg-white/5 dark:text-white"
                        : "text-foreground-700 dark:text-foreground-300"
                    }`}
                  >
                    {format(day, "MMM d")}
                  </div>
                </div>
              );
            })}
          </div>

          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragMove={handleDragMove}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <div ref={weekScrollRef} className="min-h-0 flex-1 overflow-auto">
              <div
                className="grid grid-cols-[72px_repeat(7,minmax(140px,1fr))]"
                style={{ minHeight: `${DAY_HEIGHT}px` }}
              >
                <div className="border-r border-gray-200 dark:border-[#222222]">
                  <div className="relative" style={{ height: `${DAY_HEIGHT}px` }}>
                    {HOURS.map((hour) => (
                      <div
                        key={`gutter-${hour}`}
                        className="relative border-t border-gray-200 first:border-t-0 dark:border-[#222222]"
                        style={{ height: `${HOUR_ROW_HEIGHT}px` }}
                      >
                        <div className="absolute inset-x-0 top-1/2 border-t border-gray-200/60 dark:border-[#1a1a1a]" />
                        <span className="absolute right-2 top-0 -translate-y-1/2 text-[11px] font-mono tabular-nums text-foreground-400">
                          {hourLabel(hour)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {calendarDays.map((day, dayIndex) => (
                  <WeekDayColumn
                    key={day.toISOString()}
                    dayIndex={dayIndex}
                    items={weekItems[dayIndex]}
                    dragPreview={resizePreview ?? dragPreview}
                    activeDragTaskId={activeDragTaskId}
                    activeResizeTaskId={activeResize?.taskId ?? null}
                    nowTop={nowTop}
                    isTodayColumn={isToday(day)}
                    onResizeStart={handleResizeStart}
                    onColumnRef={(index, node) => {
                      dayColumnRefs.current[index] = node;
                    }}
                    onEventClick={(event) => setSelectedEvent(event)}
                  />
                ))}
              </div>
            </div>
          </DndContext>
        </div>
      ) : (
        <>
          {/* Day Headers */}
          <div className="grid grid-cols-7 border-b border-[#333333]">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div
                key={day}
                className="px-2 py-1.5 text-right text-xs font-medium text-[#888888]"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Month Grid */}
          <div
            className="grid flex-1 grid-cols-7"
            style={{ gridTemplateRows: `repeat(${Math.ceil(calendarDays.length / 7)}, minmax(0, 1fr))` }}
          >
            {calendarDays.map((day) => {
              const dayEvents = getEventsForDay(day);
              const inMonth = isSameMonth(day, currentDate);
              const today = isToday(day);

              return (
                <div
                  key={day.toISOString()}
                  className={`min-h-[82px] border-b border-r border-[#333333] p-1 transition-colors hover:bg-[#0c0c0c] ${
                    inMonth ? "bg-[#080808]" : "bg-[#111111]"
                  }`}
                >
                  <div className="mb-0.5 flex justify-end">
                    <span
                      className={`px-1.5 py-0.5 text-xs ${
                        today
                          ? "rounded-full bg-white font-medium text-black"
                          : inMonth
                            ? "text-[#888888]"
                            : "text-[#555555]"
                      }`}
                    >
                      {format(day, "d")}
                    </span>
                  </div>

                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map((event) => (
                      <button
                        key={event.id}
                        onClick={() => setSelectedEvent(event)}
                        className="flex w-full cursor-pointer items-center gap-1 truncate rounded-sm border border-primary-500/20 bg-primary-500/10 px-1.5 py-0.5 text-left text-xs text-primary-600 transition-colors hover:border-primary-500/30 hover:bg-primary-500/20 dark:text-primary-400"
                        title={event.title}
                      >
                        {event.recurrence ? (
                          <Repeat size={10} strokeWidth={1.5} className="flex-shrink-0 text-primary-500/70" />
                        ) : (
                          <Clock size={10} strokeWidth={1.5} className="flex-shrink-0 text-primary-500/70" />
                        )}
                        <span className="truncate">{event.title}</span>
                      </button>
                    ))}

                    {dayEvents.length > 3 && (
                      <span className="px-1 text-[10px] text-[#555555]">+{dayEvents.length - 3} more</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {selectedEvent && (
        <EventDrawer event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}
    </div>
  );
}

function WeekDayColumn({
  dayIndex,
  items,
  dragPreview,
  activeDragTaskId,
  activeResizeTaskId,
  nowTop,
  isTodayColumn,
  onResizeStart,
  onColumnRef,
  onEventClick,
}: {
  dayIndex: number;
  items: PositionedTimeGridItem[];
  dragPreview: DragPreview | null;
  activeDragTaskId: string | null;
  activeResizeTaskId: string | null;
  nowTop: number;
  isTodayColumn: boolean;
  onResizeStart: (args: { taskId: string; dayIndex: number; edge: ResizeEdge; clientY: number }) => void;
  onColumnRef: (index: number, node: HTMLDivElement | null) => void;
  onEventClick: (event: CalendarEvent) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${dayIndex}` });

  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      setNodeRef(node);
      onColumnRef(dayIndex, node);
    },
    [dayIndex, onColumnRef, setNodeRef]
  );

  return (
    <div
      ref={setRefs}
      className="relative border-r border-gray-200 last:border-r-0 dark:border-[#222222]"
    >
      <div className="relative" style={{ height: `${DAY_HEIGHT}px` }}>
        {HOURS.map((hour) => (
          <div
            key={`line-${dayIndex}-${hour}`}
            className="relative border-t border-gray-200 first:border-t-0 dark:border-[#222222]"
            style={{ height: `${HOUR_ROW_HEIGHT}px` }}
          >
            <div className="absolute inset-x-0 top-1/2 border-t border-gray-200/60 dark:border-[#1a1a1a]" />
          </div>
        ))}

        {isOver && activeDragTaskId && (
          <div className="pointer-events-none absolute inset-0 z-10 bg-black/[0.03] dark:bg-white/[0.04]" />
        )}

        {dragPreview && dragPreview.dayIndex === dayIndex && (() => {
          const sourceItem = items.find((i) => i.sourceId === dragPreview.taskId);
          const top = minuteToPixels(dragPreview.startMinute);
          const height = Math.max(minuteToPixels(dragPreview.durationMinutes), MIN_CARD_HEIGHT);
          
          const previewStyle = sourceItem 
            ? positionedItemStyle(sourceItem, top, height) 
            : { top, height, left: "4px", right: "4px" };

          return (
            <div
              className="pointer-events-none absolute z-20 rounded-sm border border-dashed border-amber-500/60 bg-amber-500/10"
              style={previewStyle}
            />
          );
        })()}

        {isTodayColumn && (
          <div
            className="pointer-events-none absolute left-0 right-0 z-30"
            style={{ top: `${nowTop}px` }}
          >
            <div className="relative h-px bg-red-500">
              <span className="absolute -left-1 -top-[3px] h-2 w-2 rounded-full bg-red-500" />
            </div>
          </div>
        )}

        {items.map((item) => {
          const top = minuteToPixels(item.startMinute);
          const height = Math.max(minuteToPixels(item.durationMinutes), MIN_CARD_HEIGHT);
          const style = positionedItemStyle(item, top, height);

          if (item.kind === "event" && item.event) {
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onEventClick(item.event!)}
                className="absolute rounded-sm border border-primary-500/20 bg-primary-500/10 px-1.5 py-1 text-left text-[11px] leading-tight text-primary-600 transition-colors hover:border-primary-500/30 hover:bg-primary-500/20 dark:text-primary-400"
                style={style}
                title={item.title}
              >
                <span className="line-clamp-2">{item.title}</span>
              </button>
            );
          }

          return (
            <NotionTaskCard
              key={item.id}
              item={item}
              dayIndex={dayIndex}
              style={style}
              isResizeActive={activeResizeTaskId === item.sourceId}
              onResizeStart={onResizeStart}
            />
          );
        })}
      </div>
    </div>
  );
}

function NotionTaskCard({
  item,
  dayIndex,
  style,
  isResizeActive,
  onResizeStart,
}: {
  item: PositionedTimeGridItem;
  dayIndex: number;
  style: CSSProperties;
  isResizeActive: boolean;
  onResizeStart: (args: { taskId: string; dayIndex: number; edge: ResizeEdge; clientY: number }) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.id,
    data: {
      taskId: item.sourceId,
    },
    disabled: item.syncing || isResizeActive,
  });

  const cardStyle: CSSProperties = {
    ...style,
    transform: CSS.Translate.toString(transform),
    zIndex: isDragging || isResizeActive ? 60 : 20,
  };

  return (
    <div
      ref={setNodeRef}
      className={`group absolute rounded-sm border border-amber-500/30 bg-amber-500/10 text-amber-600 transition-[box-shadow,transform,opacity,border-color] duration-150 hover:border-amber-500/50 dark:text-amber-500 ${
        isDragging ? "scale-[1.02] shadow-md" : ""
      } ${item.syncing ? "opacity-50" : "opacity-100"} ${
        item.hasError ? "border-red-500 ring-1 ring-red-500/60" : ""
      }`}
      style={cardStyle}
      title={item.title}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className={`flex h-full w-full cursor-grab items-start px-1.5 py-1 text-left text-[11px] leading-tight outline-none ${
          isDragging ? "cursor-grabbing" : ""
        }`}
      >
        <span className="flex w-full items-center gap-1">
          <ListTodo size={11} strokeWidth={1.8} className="mt-0.5 flex-shrink-0" />
          <span className="line-clamp-3 flex-1">{item.title}</span>
          {item.syncing && <Loader2 size={11} className="ml-auto animate-spin" />}
        </span>
      </button>

      <button
        type="button"
        aria-label="Resize start"
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onResizeStart({
            taskId: item.sourceId,
            dayIndex,
            edge: "start",
            clientY: event.clientY,
          });
        }}
        className="absolute -top-1 left-1 right-1 z-20 h-2 cursor-ns-resize opacity-0 transition-opacity group-hover:opacity-100"
      >
        <span className="mx-auto mt-[2px] block h-px w-6 rounded bg-amber-500/70" />
      </button>

      <button
        type="button"
        aria-label="Resize end"
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onResizeStart({
            taskId: item.sourceId,
            dayIndex,
            edge: "end",
            clientY: event.clientY,
          });
        }}
        className="absolute -bottom-1 left-1 right-1 z-20 h-2 cursor-ns-resize opacity-0 transition-opacity group-hover:opacity-100"
      >
        <span className="mx-auto mt-[5px] block h-px w-6 rounded bg-amber-500/70" />
      </button>
    </div>
  );
}

function EventDrawer({
  event,
  onClose,
}: {
  event: CalendarEvent;
  onClose: () => void;
}) {
  const color = CATEGORY_COLORS[event.category] || CATEGORY_COLORS.event;

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />

      <div className="relative ml-auto h-full w-full max-w-md overflow-y-auto border-l border-[#222222] bg-[#0A0A0A]">
        <div className="flex items-center justify-between border-b border-[#222222] px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-xs capitalize text-[#888888]">{event.category}</span>
          </div>
          <button onClick={onClose} className="text-[#888888] hover:text-white">
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <h2 className="text-lg font-semibold text-white">{event.title}</h2>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Clock size={14} strokeWidth={1.5} className="text-[#888888]" />
              <span className="text-[#CCCCCC]">
                {format(parseISO(event.start_date), "EEEE, MMMM d, yyyy")}
                {event.end_date && ` – ${format(parseISO(event.end_date), "MMM d, yyyy")}`}
              </span>
            </div>

            {event.recurrence && (
              <div className="flex items-center gap-2 text-sm">
                <Repeat size={14} strokeWidth={1.5} className="text-[#888888]" />
                <span className="capitalize text-[#CCCCCC]">{event.recurrence}</span>
              </div>
            )}
          </div>

          {event.description && (
            <div className="border-t border-[#222222] pt-4">
              <p className="whitespace-pre-wrap text-sm text-[#aaaaaa]">{event.description}</p>
            </div>
          )}

          {event.created_by && (
            <div className="border-t border-[#222222] pt-4">
              <span className="text-xs text-[#555555]">Created by </span>
              <span className="text-xs capitalize text-[#888888]">{event.created_by}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
