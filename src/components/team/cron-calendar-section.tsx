"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  addWeeks,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfWeek,
  format,
  isSameDay,
  isToday,
  startOfWeek,
  subWeeks,
} from "date-fns";
import { Button, Card, CardBody, Chip } from "@heroui/react";
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CircleOff,
  Clock3,
  Repeat,
  TriangleAlert,
  X,
} from "lucide-react";
import type { CronJob } from "@/lib/api";
import { normalizeAgentId } from "@/lib/agents";

const HOURS_IN_DAY = 24;
const HOUR_ROW_HEIGHT = 52;
const DAY_HEIGHT = HOURS_IN_DAY * HOUR_ROW_HEIGHT;
const DISPLAY_DURATION_MINUTES = 42;
const MIN_CARD_HEIGHT = 26;
const HOURS = Array.from({ length: HOURS_IN_DAY }, (_, index) => index);

const AGENT_PALETTE: Record<string, { accent: string; background: string; border: string; text: string }> = {
  frank: {
    accent: "#38bdf8",
    background: "rgba(56, 189, 248, 0.14)",
    border: "rgba(56, 189, 248, 0.35)",
    text: "#bae6fd",
  },
  tom: {
    accent: "#34d399",
    background: "rgba(52, 211, 153, 0.14)",
    border: "rgba(52, 211, 153, 0.35)",
    text: "#bbf7d0",
  },
  michael: {
    accent: "#f59e0b",
    background: "rgba(245, 158, 11, 0.14)",
    border: "rgba(245, 158, 11, 0.35)",
    text: "#fde68a",
  },
  joanna: {
    accent: "#f472b6",
    background: "rgba(244, 114, 182, 0.14)",
    border: "rgba(244, 114, 182, 0.35)",
    text: "#fbcfe8",
  },
  ivy: {
    accent: "#22c55e",
    background: "rgba(34, 197, 94, 0.14)",
    border: "rgba(34, 197, 94, 0.35)",
    text: "#bbf7d0",
  },
  sloane: {
    accent: "#a78bfa",
    background: "rgba(167, 139, 250, 0.14)",
    border: "rgba(167, 139, 250, 0.35)",
    text: "#ddd6fe",
  },
  derrick: {
    accent: "#f97316",
    background: "rgba(249, 115, 22, 0.14)",
    border: "rgba(249, 115, 22, 0.35)",
    text: "#fdba74",
  },
  default: {
    accent: "#94a3b8",
    background: "rgba(148, 163, 184, 0.14)",
    border: "rgba(148, 163, 184, 0.35)",
    text: "#e2e8f0",
  },
};

type ParsedCronField = {
  values: number[];
  wildcard: boolean;
};

type ParsedCron = {
  minute: ParsedCronField;
  hour: ParsedCronField;
  dayOfMonth: ParsedCronField;
  month: ParsedCronField;
  dayOfWeek: ParsedCronField;
};

type CronOccurrence = {
  key: string;
  job: CronJob;
  dayIndex: number;
  startMinute: number;
  durationMinutes: number;
  timestamp: Date | null;
  kind: "cron" | "at";
};

type PositionedOccurrence = CronOccurrence & {
  laneIndex: number;
  laneCount: number;
};

function range(start: number, end: number, step = 1): number[] {
  const values: number[] = [];
  for (let value = start; value <= end; value += step) {
    values.push(value);
  }
  return values;
}

function hourLabel(hour: number): string {
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}${suffix}`;
}

function minuteToPixels(minutes: number): number {
  return (minutes / 60) * HOUR_ROW_HEIGHT;
}

function sortNumberAsc(a: number, b: number): number {
  return a - b;
}

function normalizeCronValue(value: number, max: number, treatSevenAsSunday = false): number | null {
  if (!Number.isInteger(value)) return null;
  if (treatSevenAsSunday && value === 7) return 0;
  if (value < 0 || value > max) return null;
  return value;
}

function expandCronPart(part: string, min: number, max: number, treatSevenAsSunday = false): number[] {
  const trimmed = part.trim();
  if (!trimmed) return [];

  const [base, stepRaw] = trimmed.split("/");
  const step = stepRaw ? Number.parseInt(stepRaw, 10) : 1;
  if (!Number.isInteger(step) || step <= 0) return [];

  if (base === "*") {
    return range(min, max, step);
  }

  const values: number[] = [];
  const pushValue = (value: number) => {
    const normalized = normalizeCronValue(value, max, treatSevenAsSunday);
    if (normalized !== null && normalized >= min) {
      values.push(normalized);
    }
  };

  if (base.includes("-")) {
    const [startRaw, endRaw] = base.split("-");
    const start = Number.parseInt(startRaw, 10);
    const end = Number.parseInt(endRaw, 10);
    if (!Number.isInteger(start) || !Number.isInteger(end) || end < start) return [];

    for (let value = start; value <= end; value += step) {
      pushValue(value);
    }
    return values;
  }

  const start = Number.parseInt(base, 10);
  if (!Number.isInteger(start)) return [];

  if (stepRaw) {
    for (let value = start; value <= max; value += step) {
      pushValue(value);
    }
    return values;
  }

  pushValue(start);
  return values;
}

function parseCronField(raw: string, min: number, max: number, treatSevenAsSunday = false): ParsedCronField {
  const field = raw.trim();
  if (field === "*") {
    return { values: range(min, max), wildcard: true };
  }

  const set = new Set<number>();
  for (const part of field.split(",")) {
    for (const value of expandCronPart(part, min, max, treatSevenAsSunday)) {
      set.add(value);
    }
  }

  return {
    values: Array.from(set).sort(sortNumberAsc),
    wildcard: false,
  };
}

function parseCronExpression(expr?: string): ParsedCron | null {
  if (!expr) return null;
  const segments = expr.trim().split(/\s+/);
  if (segments.length !== 5) return null;

  return {
    minute: parseCronField(segments[0], 0, 59),
    hour: parseCronField(segments[1], 0, 23),
    dayOfMonth: parseCronField(segments[2], 1, 31),
    month: parseCronField(segments[3], 1, 12),
    dayOfWeek: parseCronField(segments[4], 0, 7, true),
  };
}

function cronMatchesDate(date: Date, parsed: ParsedCron): boolean {
  const month = date.getMonth() + 1;
  if (!parsed.month.values.includes(month)) return false;

  const dayOfMonth = date.getDate();
  const dayOfWeek = date.getDay();
  const dayOfMonthMatch = parsed.dayOfMonth.values.includes(dayOfMonth);
  const dayOfWeekMatch = parsed.dayOfWeek.values.includes(dayOfWeek);

  if (parsed.dayOfMonth.wildcard && parsed.dayOfWeek.wildcard) return true;
  if (parsed.dayOfMonth.wildcard) return dayOfWeekMatch;
  if (parsed.dayOfWeek.wildcard) return dayOfMonthMatch;
  return dayOfMonthMatch || dayOfWeekMatch;
}

function applyOverlapLayout(items: CronOccurrence[]): PositionedOccurrence[] {
  if (items.length <= 1) {
    return items.map((item) => ({ ...item, laneIndex: 0, laneCount: 1 }));
  }

  const sorted = [...items].sort((a, b) => a.startMinute - b.startMinute || a.key.localeCompare(b.key));
  const layout = new Map<string, { laneIndex: number; laneCount: number }>();
  let cursor = 0;

  while (cursor < sorted.length) {
    const cluster: CronOccurrence[] = [sorted[cursor]];
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
      layout.set(item.key, { laneIndex, laneCount: 0 });
    }

    const laneCount = Math.max(1, laneEnds.length);
    for (const item of cluster) {
      const existing = layout.get(item.key);
      if (existing) existing.laneCount = laneCount;
    }

    cursor = next;
  }

  return sorted.map((item) => {
    const lane = layout.get(item.key) ?? { laneIndex: 0, laneCount: 1 };
    return {
      ...item,
      laneIndex: lane.laneIndex,
      laneCount: lane.laneCount,
    };
  });
}

function positionedItemStyle(item: PositionedOccurrence, top: number, height: number): CSSProperties {
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

function getAgentPalette(agentId?: string | null) {
  const normalized = normalizeAgentId(agentId) || "default";
  return AGENT_PALETTE[normalized] || AGENT_PALETTE.default;
}

function formatTimeLabel(startMinute: number): string {
  const hours = Math.floor(startMinute / 60);
  const minutes = startMinute % 60;
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return format(date, minutes === 0 ? "ha" : "h:mma");
}

function formatTimestamp(timestamp?: number | string | null): string {
  if (!timestamp) return "—";
  const date = typeof timestamp === "number" ? new Date(timestamp) : new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "—";
  return format(date, "EEE, MMM d • h:mma");
}

function formatScheduleLabel(job: CronJob): string {
  const schedule = job.schedule;
  if (!schedule) return "No schedule";
  if (schedule.kind === "cron") {
    return [schedule.expr || "cron", schedule.tz].filter(Boolean).join(" • ");
  }
  if (schedule.kind === "at") {
    return [schedule.at ? formatTimestamp(schedule.at) : "One-time", schedule.tz].filter(Boolean).join(" • ");
  }
  return schedule.kind;
}

function buildOccurrences(jobs: CronJob[], weekDays: Date[]): PositionedOccurrence[] {
  const byDay = Array.from({ length: 7 }, () => [] as CronOccurrence[]);
  const weekStart = weekDays[0];
  const weekEnd = weekDays[6];
  if (!weekStart || !weekEnd) return byDay.flatMap((items) => applyOverlapLayout(items));

  for (const job of jobs) {
    const schedule = job.schedule;
    if (!schedule) continue;

    if (schedule.kind === "at" && schedule.at) {
      const runAt = new Date(schedule.at);
      if (Number.isNaN(runAt.getTime())) continue;
      if (runAt < weekStart || runAt > new Date(weekEnd.getTime() + 24 * 60 * 60 * 1000 - 1)) continue;

      const dayIndex = differenceInCalendarDays(runAt, weekStart);
      if (dayIndex < 0 || dayIndex > 6) continue;

      byDay[dayIndex].push({
        key: `${job.id}-at-${runAt.toISOString()}`,
        job,
        dayIndex,
        startMinute: runAt.getHours() * 60 + runAt.getMinutes(),
        durationMinutes: DISPLAY_DURATION_MINUTES,
        timestamp: runAt,
        kind: "at",
      });
      continue;
    }

    if (schedule.kind !== "cron") continue;

    const parsed = parseCronExpression(schedule.expr);
    if (!parsed || parsed.hour.values.length === 0 || parsed.minute.values.length === 0) continue;

    for (let dayIndex = 0; dayIndex < weekDays.length; dayIndex += 1) {
      const day = weekDays[dayIndex];
      if (!cronMatchesDate(day, parsed)) continue;

      for (const hour of parsed.hour.values) {
        for (const minute of parsed.minute.values) {
          const runAt = new Date(day);
          runAt.setHours(hour, minute, 0, 0);
          byDay[dayIndex].push({
            key: `${job.id}-${format(day, "yyyy-MM-dd")}-${hour}-${minute}`,
            job,
            dayIndex,
            startMinute: hour * 60 + minute,
            durationMinutes: DISPLAY_DURATION_MINUTES,
            timestamp: runAt,
            kind: "cron",
          });
        }
      }
    }
  }

  return byDay.flatMap((items) => applyOverlapLayout(items));
}

function readPayloadMessage(job: CronJob): string | null {
  const payload = job.payload;
  if (!payload || typeof payload !== "object") return null;
  const message = payload.message;
  return typeof message === "string" && message.trim() ? message : null;
}

export function CronCalendarSection({ initialJobs }: { initialJobs: CronJob[] }) {
  const [jobs, setJobs] = useState<CronJob[]>(initialJobs);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedOccurrenceKey, setSelectedOccurrenceKey] = useState<string | null>(null);
  const [mobileDetailsOpen, setMobileDetailsOpen] = useState(false);
  const [isDesktopLayout, setIsDesktopLayout] = useState(true);
  const weekScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setJobs(initialJobs);
  }, [initialJobs]);

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      try {
        const response = await fetch("/api/mc/cron/jobs", { cache: "no-store" });
        if (!response.ok) throw new Error(`Refresh failed (${response.status})`);
        const data = await response.json();
        if (!cancelled && Array.isArray(data)) {
          setJobs(data);
          setRefreshError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setRefreshError(error instanceof Error ? error.message : "Unable to refresh cron jobs");
        }
      }
    };

    const intervalId = window.setInterval(() => {
      void refresh();
    }, 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 0 });
    const end = endOfWeek(currentDate, { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const occurrences = useMemo(() => buildOccurrences(jobs, weekDays), [jobs, weekDays]);

  const selectedOccurrence = useMemo(
    () => occurrences.find((occurrence) => occurrence.key === selectedOccurrenceKey) ?? null,
    [occurrences, selectedOccurrenceKey]
  );

  useEffect(() => {
    if (occurrences.length === 0) {
      setSelectedOccurrenceKey(null);
      return;
    }

    if (selectedOccurrenceKey && occurrences.some((occurrence) => occurrence.key === selectedOccurrenceKey)) {
      return;
    }

    const now = Date.now();
    const upcoming = occurrences.find((occurrence) => occurrence.timestamp && occurrence.timestamp.getTime() >= now);
    setSelectedOccurrenceKey((upcoming ?? occurrences[0]).key);
  }, [occurrences, selectedOccurrenceKey]);

  useEffect(() => {
    if (!weekScrollRef.current) return;
    const targetTop = Math.max(0, minuteToPixels(new Date().getHours() * 60 + new Date().getMinutes()) - 180);
    weekScrollRef.current.scrollTop = targetTop;
  }, [weekDays]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(min-width: 1280px)");
    const syncLayout = () => {
      const desktop = mediaQuery.matches;
      setIsDesktopLayout(desktop);
      if (desktop) {
        setMobileDetailsOpen(false);
      }
    };

    syncLayout();
    mediaQuery.addEventListener("change", syncLayout);
    return () => mediaQuery.removeEventListener("change", syncLayout);
  }, []);

  const selectOccurrence = (occurrenceKey: string) => {
    setSelectedOccurrenceKey(occurrenceKey);
    if (!isDesktopLayout) {
      setMobileDetailsOpen(true);
    }
  };

  const jobsByAgent = useMemo(() => {
    const counts = new Map<string, number>();
    for (const job of jobs) {
      const agentId = normalizeAgentId(job.agentId) || "system";
      counts.set(agentId, (counts.get(agentId) || 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [jobs]);

  const primaryTimeZone = useMemo(() => {
    const counts = new Map<string, number>();
    for (const job of jobs) {
      const tz = typeof job.schedule?.tz === "string" ? job.schedule.tz : "Local time";
      counts.set(tz, (counts.get(tz) || 0) + 1);
    }

    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "Local time";
  }, [jobs]);

  const enabledJobCount = jobs.filter((job) => job.enabled !== false).length;
  const disabledJobCount = jobs.length - enabledJobCount;
  const jobsWithErrors = jobs.filter((job) => Number(job.state?.consecutiveErrors || 0) > 0).length;
  const today = new Date();
  const todayLineTop = minuteToPixels(today.getHours() * 60 + today.getMinutes());

  return (
    <section className="mt-8 rounded border border-divider bg-white dark:bg-[#0A0A0A]">
      <div className="border-b border-divider px-4 py-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-foreground-500" />
              <p className="text-xs uppercase tracking-[0.2em] text-foreground-400">Cron Calendar</p>
            </div>
            <h2 className="mt-2 text-lg font-semibold text-foreground dark:text-white">
              Weekly schedule for agent automation
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-foreground-500 dark:text-[#A1A1AA]">
              Color-coded by agent so it’s easy to scan recurring jobs, spot overlaps, and inspect the full JSON payload on click.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Chip size="sm" variant="flat" color="primary">{enabledJobCount} enabled</Chip>
            {disabledJobCount > 0 ? <Chip size="sm" variant="flat">{disabledJobCount} disabled</Chip> : null}
            <Chip size="sm" variant="flat">{occurrences.length} runs this week</Chip>
            {jobsWithErrors > 0 ? <Chip size="sm" variant="flat" color="danger">{jobsWithErrors} with errors</Chip> : null}
            <Chip size="sm" variant="flat">{primaryTimeZone}</Chip>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {jobsByAgent.map(([agentId, count]) => {
            const palette = getAgentPalette(agentId);
            return (
              <div
                key={agentId}
                className="inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs capitalize"
                style={{
                  borderColor: palette.border,
                  backgroundColor: palette.background,
                  color: palette.text,
                }}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: palette.accent }} />
                <span>{agentId}</span>
                <span className="text-[11px] opacity-70">{count}</span>
              </div>
            );
          })}
        </div>

        {refreshError ? (
          <p className="mt-3 text-xs text-danger-500">Live refresh paused: {refreshError}</p>
        ) : null}
      </div>

      <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="overflow-hidden rounded-md border border-divider bg-white dark:bg-[#080808]">
          <div className="flex items-center justify-between border-b border-divider px-3 py-2.5">
            <div>
              <p className="text-sm font-medium text-foreground dark:text-white">
                {`Week of ${format(weekDays[0], "MMM d")} – ${format(weekDays[6], "MMM d, yyyy")}`}
              </p>
              <p className="mt-1 text-[11px] text-foreground-400">Times shown in {primaryTimeZone}</p>
            </div>

            <div className="flex items-center gap-2">
              <Button size="sm" variant="flat" onPress={() => setCurrentDate(new Date())}>Today</Button>
              <div className="flex">
                <Button
                  size="sm"
                  variant="flat"
                  isIconOnly
                  className="rounded-r-none border border-divider bg-white dark:bg-[#101010]"
                  onPress={() => setCurrentDate((value) => subWeeks(value, 1))}
                >
                  <ChevronLeft size={14} />
                </Button>
                <Button
                  size="sm"
                  variant="flat"
                  isIconOnly
                  className="rounded-l-none border border-l-0 border-divider bg-white dark:bg-[#101010]"
                  onPress={() => setCurrentDate((value) => addWeeks(value, 1))}
                >
                  <ChevronRight size={14} />
                </Button>
              </div>
            </div>
          </div>

          {jobs.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-foreground-400">
              No cron jobs found.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-[72px_repeat(7,minmax(140px,1fr))] border-b border-divider">
                <div className="border-r border-divider px-2 py-2 text-right text-[11px] font-mono uppercase tracking-wide text-foreground-400">
                  HRS
                </div>
                {weekDays.map((day) => {
                  const currentDay = isToday(day);
                  return (
                    <div key={day.toISOString()} className="border-r border-divider px-2 py-2 last:border-r-0">
                      <div className="text-[11px] font-mono uppercase tracking-wide text-foreground-500">
                        {format(day, "EEE")}
                      </div>
                      <div
                        className={`mt-1 inline-flex rounded-sm px-2 py-1 text-sm ${
                          currentDay
                            ? "bg-black/5 font-semibold text-foreground-900 dark:bg-white/10 dark:text-white"
                            : "text-foreground-700 dark:text-foreground-300"
                        }`}
                      >
                        {format(day, "MMM d")}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div ref={weekScrollRef} className="max-h-[720px] overflow-auto">
                <div className="grid grid-cols-[72px_repeat(7,minmax(140px,1fr))]" style={{ minHeight: `${DAY_HEIGHT}px` }}>
                  <div className="border-r border-divider">
                    <div className="relative" style={{ height: `${DAY_HEIGHT}px` }}>
                      {HOURS.map((hour) => (
                        <div
                          key={`gutter-${hour}`}
                          className="relative border-t border-divider first:border-t-0"
                          style={{ height: `${HOUR_ROW_HEIGHT}px` }}
                        >
                          <div className="absolute inset-x-0 top-1/2 border-t border-divider/60" />
                          <span className="absolute right-2 top-0 -translate-y-1/2 text-[11px] font-mono text-foreground-400">
                            {hourLabel(hour)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {weekDays.map((day, dayIndex) => {
                    const dayItems = occurrences.filter((occurrence) => occurrence.dayIndex === dayIndex);
                    return (
                      <div key={day.toISOString()} className="relative border-r border-divider last:border-r-0">
                        <div className="relative" style={{ height: `${DAY_HEIGHT}px` }}>
                          {HOURS.map((hour) => (
                            <div
                              key={`line-${dayIndex}-${hour}`}
                              className="relative border-t border-divider first:border-t-0"
                              style={{ height: `${HOUR_ROW_HEIGHT}px` }}
                            >
                              <div className="absolute inset-x-0 top-1/2 border-t border-divider/60" />
                            </div>
                          ))}

                          {isSameDay(day, today) ? (
                            <div className="pointer-events-none absolute left-0 right-0 z-30" style={{ top: `${todayLineTop}px` }}>
                              <div className="relative h-px bg-danger-500">
                                <span className="absolute -left-1 -top-[3px] h-2 w-2 rounded-full bg-danger-500" />
                              </div>
                            </div>
                          ) : null}

                          {dayItems.map((occurrence) => {
                            const palette = getAgentPalette(occurrence.job.agentId as string | undefined);
                            const top = minuteToPixels(occurrence.startMinute);
                            const height = Math.max(minuteToPixels(occurrence.durationMinutes), MIN_CARD_HEIGHT);
                            const style = positionedItemStyle(occurrence, top, height);
                            const disabled = occurrence.job.enabled === false;
                            const selected = occurrence.key === selectedOccurrenceKey;

                            return (
                              <button
                                key={occurrence.key}
                                type="button"
                                onClick={() => selectOccurrence(occurrence.key)}
                                className={`absolute rounded-sm border px-2 py-1 text-left transition-all hover:brightness-110 ${
                                  selected ? "ring-1 ring-white/70" : ""
                                } ${disabled ? "opacity-55" : "opacity-100"}`}
                                style={{
                                  ...style,
                                  borderColor: palette.border,
                                  backgroundColor: palette.background,
                                  color: palette.text,
                                }}
                                title={`${occurrence.job.name || "Untitled job"} • ${formatTimeLabel(occurrence.startMinute)}`}
                              >
                                <div className="flex items-start gap-1.5 text-[11px] leading-tight">
                                  <span className="mt-[2px] shrink-0" style={{ color: palette.accent }}>
                                    {occurrence.kind === "cron" ? <Repeat size={11} /> : <Clock3 size={11} />}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1">
                                      <span className="font-mono text-[10px] uppercase tracking-wide opacity-80">
                                        {formatTimeLabel(occurrence.startMinute)}
                                      </span>
                                      {disabled ? <CircleOff className="h-3 w-3 opacity-70" /> : null}
                                    </div>
                                    <div className="truncate font-medium">
                                      {occurrence.job.name || "Untitled job"}
                                    </div>
                                    <div className="truncate text-[10px] capitalize opacity-75">
                                      {normalizeAgentId(occurrence.job.agentId) || "system"}
                                    </div>
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        <Card className="hidden border border-divider bg-white dark:bg-content1 xl:sticky xl:top-4 xl:block xl:self-start">
          <CardBody className="gap-4 p-4 text-foreground dark:text-white">
            <CronOccurrenceDetails occurrence={selectedOccurrence} />
          </CardBody>
        </Card>
      </div>

      {mobileDetailsOpen && selectedOccurrence ? (
        <div
          className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm xl:hidden"
          onClick={() => setMobileDetailsOpen(false)}
        >
          <div
            className="absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-hidden rounded-t-3xl border border-divider bg-white shadow-2xl dark:bg-[#121212]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-divider px-4 py-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-foreground-400">Cron job details</p>
                <p className="mt-1 text-sm font-medium text-foreground dark:text-white">
                  {selectedOccurrence.job.name || "Untitled job"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMobileDetailsOpen(false)}
                className="rounded-full border border-divider p-2 text-foreground-500 transition hover:bg-black/5 dark:hover:bg-white/10"
                aria-label="Close cron job details"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="overflow-y-auto p-4 text-foreground dark:text-white">
              <CronOccurrenceDetails occurrence={selectedOccurrence} hideTitle />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function CronOccurrenceDetails({
  occurrence,
  hideTitle = false,
}: {
  occurrence: PositionedOccurrence | null;
  hideTitle?: boolean;
}) {
  if (!occurrence) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-foreground-400">Pick a cron entry to inspect its metadata and raw JSON.</p>
      </div>
    );
  }

  return (
    <>
      {!hideTitle ? (
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-foreground-400">
            {occurrence.kind === "cron" ? "Recurring job" : "One-time job"}
          </p>
          <h3 className="mt-2 text-lg font-semibold">
            {occurrence.job.name || "Untitled job"}
          </h3>
          {occurrence.job.description ? (
            <p className="mt-2 text-sm text-foreground-500 dark:text-[#A1A1AA]">
              {occurrence.job.description}
            </p>
          ) : null}
        </div>
      ) : occurrence.job.description ? (
        <p className="text-sm text-foreground-500 dark:text-[#A1A1AA]">
          {occurrence.job.description}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Chip size="sm" variant="flat" className="capitalize">
          {normalizeAgentId(occurrence.job.agentId) || "system"}
        </Chip>
        <Chip size="sm" variant="flat">
          {occurrence.job.enabled === false ? "Disabled" : "Enabled"}
        </Chip>
        {occurrence.job.schedule?.tz ? (
          <Chip size="sm" variant="flat">{occurrence.job.schedule?.tz}</Chip>
        ) : null}
      </div>

      <div className="grid gap-3 rounded-md border border-divider p-3 text-sm sm:grid-cols-2">
        <DetailRow label="Scheduled for" value={formatTimestamp(occurrence.timestamp?.toISOString() || null)} />
        <DetailRow label="Schedule" value={formatScheduleLabel(occurrence.job)} />
        <DetailRow label="Next run" value={formatTimestamp(occurrence.job.state?.nextRunAtMs as number | undefined)} />
        <DetailRow label="Last run" value={formatTimestamp(occurrence.job.state?.lastRunAtMs as number | undefined)} />
        <DetailRow label="Last status" value={String(occurrence.job.state?.lastStatus || occurrence.job.state?.lastRunStatus || "—")} />
        <DetailRow label="Delivery" value={String((occurrence.job.delivery?.mode as string | undefined) || "none")} />
        <DetailRow label="Wake mode" value={String(occurrence.job.wakeMode || "—")} />
        <DetailRow label="Session target" value={String(occurrence.job.sessionTarget || "—")} />
      </div>

      {Number(occurrence.job.state?.consecutiveErrors || 0) > 0 ? (
        <div className="rounded-md border border-danger-500/30 bg-danger-500/10 p-3 text-sm text-danger-500">
          <div className="flex items-center gap-2 font-medium">
            <TriangleAlert className="h-4 w-4" />
            {occurrence.job.state?.consecutiveErrors} consecutive errors
          </div>
          {occurrence.job.state?.lastDiagnosticSummary ? (
            <p className="mt-2 text-xs leading-relaxed text-danger-400">
              {String(occurrence.job.state?.lastDiagnosticSummary)}
            </p>
          ) : null}
        </div>
      ) : null}

      {readPayloadMessage(occurrence.job) ? (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-foreground-400">Prompt / message</p>
          <div className="mt-2 rounded-md border border-divider bg-black/[0.02] p-3 text-xs leading-relaxed text-foreground-600 dark:bg-white/[0.03] dark:text-[#CFCFCF]">
            <pre className="whitespace-pre-wrap font-sans">{readPayloadMessage(occurrence.job)}</pre>
          </div>
        </div>
      ) : null}

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-foreground-400">Raw JSON</p>
        <div className="mt-2 max-h-[360px] overflow-auto rounded-md border border-divider bg-[#050505] p-3">
          <pre className="text-xs leading-relaxed text-[#CFCFCF]">
            {JSON.stringify(occurrence.job, null, 2)}
          </pre>
        </div>
      </div>
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-foreground-400">{label}</p>
      <p className="mt-1 break-words text-sm text-foreground-700 dark:text-[#E4E4E7]">{value || "—"}</p>
    </div>
  );
}
