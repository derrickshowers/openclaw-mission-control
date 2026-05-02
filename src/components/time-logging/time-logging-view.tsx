"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Button, Input } from "@heroui/react";
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Search,
} from "lucide-react";
import { addDays, addWeeks, format, parseISO, subWeeks } from "date-fns";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  api,
  type TimeLoggingCategoryHours,
  type TimeLoggingMonthBucket,
  type TimeLoggingSummary,
} from "@/lib/api";

const CHART_COLORS = [
  "#8b5cf6",
  "#06b6d4",
  "#f59e0b",
  "#ef4444",
  "#10b981",
  "#3b82f6",
  "#ec4899",
  "#84cc16",
  "#f97316",
  "#14b8a6",
  "#a855f7",
  "#eab308",
];

const STACKED_CATEGORY_LIMIT = 7;
const ON_TARGET_TOLERANCE_HOURS = 1;

type TabKey = "weekly" | "monthly";
type MonthMode = "hours" | "share";
type MonthRange = 6 | 12 | 18 | 24;

function formatHours(hours: number): string {
  if (hours === 0) return "0h";
  return `${Number.isInteger(hours) ? hours : hours.toFixed(2).replace(/\.00$/, "").replace(/0$/, "")}h`;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1).replace(/\.0$/, "")}%`;
}

function formatWeekLabel(week: string): string {
  const start = parseISO(`${week}T00:00:00`);
  const end = addDays(start, 6);
  return `${format(start, "MMM d")} – ${format(end, "MMM d")}`;
}

function formatMonthLabel(month: string): string {
  return format(parseISO(`${month}-01T00:00:00`), "MMM yyyy");
}

function getCategoryColor(category: string): string {
  let hash = 0;
  for (let i = 0; i < category.length; i += 1) {
    hash = (hash << 5) - hash + category.charCodeAt(i);
    hash |= 0;
  }
  return CHART_COLORS[Math.abs(hash) % CHART_COLORS.length];
}

function getTopCategoriesFromBuckets(
  buckets: Array<{ byCategory: TimeLoggingCategoryHours[] }>,
  limit = STACKED_CATEGORY_LIMIT,
): string[] {
  const totals = new Map<string, number>();
  for (const bucket of buckets) {
    for (const entry of bucket.byCategory) {
      totals.set(entry.category, (totals.get(entry.category) ?? 0) + entry.hours);
    }
  }

  return Array.from(totals.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([category]) => category);
}

function buildStackedChartData<T extends { byCategory: TimeLoggingCategoryHours[] }>(
  buckets: T[],
  labelKey: keyof T,
  topCategories: string[],
) {
  return buckets.map((bucket) => {
    const row: Record<string, string | number> = {
      label: String(bucket[labelKey]),
      totalHours: bucket.byCategory.reduce((sum, entry) => sum + entry.hours, 0),
    };

    let otherHours = 0;
    for (const entry of bucket.byCategory) {
      if (topCategories.includes(entry.category)) {
        row[entry.category] = entry.hours;
      } else {
        otherHours += entry.hours;
      }
    }

    if (otherHours > 0) {
      row.Other = otherHours;
    }

    return row;
  });
}

function buildMonthlyTrendData(
  months: TimeLoggingMonthBucket[],
  selectedCategories: string[],
  mode: MonthMode,
) {
  return months.map((month) => {
    const row: Record<string, string | number | boolean> = {
      month: month.month,
      label: formatMonthLabel(month.month),
      totalHours: month.totalHours,
      isPartial: month.isPartial,
    };

    for (const category of selectedCategories) {
      const entry = month.byCategory.find((item) => item.category === category);
      const hours = entry?.hours ?? 0;
      row[category] = mode === "share" && month.totalHours > 0 ? (hours / month.totalHours) * 100 : hours;
    }

    return row;
  });
}

function TimeLoggingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-md border border-white/10 bg-white/5" />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-md border border-white/10 bg-white/5" />
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="h-72 animate-pulse rounded-md border border-white/10 bg-white/5" />
        <div className="h-72 animate-pulse rounded-md border border-white/10 bg-white/5" />
      </div>
      <div className="h-72 animate-pulse rounded-md border border-white/10 bg-white/5" />
    </div>
  );
}

export function TimeLoggingView() {
  const [activeTab, setActiveTab] = useState<TabKey>("weekly");
  const [summary, setSummary] = useState<TimeLoggingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [monthMode, setMonthMode] = useState<MonthMode>("hours");
  const [monthRange, setMonthRange] = useState<MonthRange>(12);
  const [includePartialMonth, setIncludePartialMonth] = useState(false);
  const [categoryQuery, setCategoryQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const loadSummary = useCallback(async (week?: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const nextSummary = await api.getTimeLoggingSummary(week ? { week } : undefined);
      setSummary(nextSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load time logging");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSummary(null);
  }, [loadSummary]);

  useEffect(() => {
    if (!summary) return;
    setSelectedCategories((current) => {
      const allCategories = summary.categories.map((category) => category.canonicalName);
      const preserved = current.filter((category) => allCategories.includes(category));
      if (preserved.length > 0) return preserved;

      const defaultCategories = summary.categories
        .filter((category) => (category.idealWeekHours ?? 0) > 0 || category.totalHoursAllTime > 60)
        .slice(0, 6)
        .map((category) => category.canonicalName);

      return defaultCategories.length > 0 ? defaultCategories : allCategories.slice(0, 6);
    });
  }, [summary]);

  const currentWeekStart = summary?.weekly.selectedWeek ? parseISO(`${summary.weekly.selectedWeek}T00:00:00`) : null;
  const weekLabel = currentWeekStart
    ? `${format(currentWeekStart, "MMM d")} – ${format(addDays(currentWeekStart, 6), "MMM d, yyyy")}`
    : "";

  const weeklyMetrics = useMemo(() => {
    if (!summary) return null;

    const onTargetCount = summary.weekly.byCategory.filter(
      (entry) => entry.hasTarget && Math.abs(entry.deltaHours) <= ON_TARGET_TOLERANCE_HOURS,
    ).length;

    const largestUnder = summary.weekly.byCategory
      .filter((entry) => entry.deltaHours < 0)
      .sort((a, b) => a.deltaHours - b.deltaHours)[0] ?? null;
    const largestOver = summary.weekly.byCategory
      .filter((entry) => entry.deltaHours > 0)
      .sort((a, b) => b.deltaHours - a.deltaHours)[0] ?? null;

    return {
      onTargetCount,
      largestUnder,
      largestOver,
    };
  }, [summary]);

  const weeklyComparisonData = useMemo(() => {
    if (!summary) return [];
    return summary.weekly.byCategory.map((entry) => ({
      category: entry.category,
      actualHours: entry.actualHours,
      idealHours: entry.idealHours ?? 0,
      deltaHours: entry.deltaHours,
    }));
  }, [summary]);

  const weekStackCategories = useMemo(
    () => getTopCategoriesFromBuckets(summary?.weekly.last8Weeks ?? []),
    [summary],
  );

  const weeklyStackData = useMemo<Record<string, string | number>[]>(() => {
    if (!summary) return [];
    return buildStackedChartData(summary.weekly.last8Weeks, "week", weekStackCategories).map((entry) => ({
      ...entry,
      shortLabel: format(parseISO(`${String(entry.label)}T00:00:00`), "MMM d"),
    }));
  }, [summary, weekStackCategories]);

  const dailyStackCategories = useMemo(
    () => getTopCategoriesFromBuckets(summary?.weekly.daily ?? [], STACKED_CATEGORY_LIMIT - 1),
    [summary],
  );

  const dailyStackData = useMemo<Record<string, string | number>[]>(() => {
    if (!summary) return [];
    return buildStackedChartData(summary.weekly.daily, "day", dailyStackCategories).map((entry) => ({
      ...entry,
      shortLabel: format(parseISO(`${String(entry.label)}T00:00:00`), "EEE"),
    }));
  }, [summary, dailyStackCategories]);

  const monthBuckets = useMemo(() => {
    if (!summary) return [];
    const filtered = includePartialMonth
      ? summary.monthly.months
      : summary.monthly.months.filter((month) => !month.isPartial);
    return filtered.slice(-monthRange);
  }, [summary, includePartialMonth, monthRange]);

  const filteredCategories = useMemo(() => {
    if (!summary) return [];
    const query = categoryQuery.trim().toLowerCase();
    return summary.categories.filter((category) => {
      if (!query) return true;
      return category.canonicalName.toLowerCase().includes(query);
    });
  }, [summary, categoryQuery]);

  const monthlyTrendData = useMemo(
    () => buildMonthlyTrendData(monthBuckets, selectedCategories, monthMode),
    [monthBuckets, selectedCategories, monthMode],
  );

  const monthlyTotalData = useMemo<Array<{ label: string; totalHours: number; isPartial: boolean }>>(
    () => monthBuckets.map((month) => ({ label: formatMonthLabel(month.month), totalHours: month.totalHours, isPartial: month.isPartial })),
    [monthBuckets],
  );

  const handleWeekChange = async (nextWeek: string) => {
    await loadSummary(nextWeek);
  };

  if (loading && !summary) {
    return <TimeLoggingSkeleton />;
  }

  if (error && !summary) {
    return (
      <div className="rounded-md border border-danger/40 bg-danger/10 p-4 text-sm text-danger-300">
        Failed to load Time Logging: {error}
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="rounded-md border border-white/10 bg-[#111111] p-6 text-sm text-foreground-400">
        No time logs available yet.
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full max-w-[1440px] flex-col gap-4 pb-6">
      <div className="flex flex-col gap-3 rounded-md border border-white/10 bg-[#111111] p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <BarChart3 size={18} />
              <span>Time Logging</span>
            </div>
            <div className="mt-1 text-sm text-foreground-400">{weekLabel}</div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-md border border-white/10 bg-black/20 p-1">
              {(["weekly", "monthly"] as TabKey[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`rounded px-3 py-1.5 text-sm capitalize transition ${
                    activeTab === tab
                      ? "bg-white/10 text-white"
                      : "text-foreground-400 hover:text-foreground"
                  }`}
                >
                  {tab === "monthly" ? "Monthly Trends" : "Weekly"}
                </button>
              ))}
            </div>

            <Button
              size="sm"
              variant="flat"
              className="border border-white/10 bg-black/20 text-foreground"
              onPress={() => currentWeekStart && void handleWeekChange(format(subWeeks(currentWeekStart, 1), "yyyy-MM-dd"))}
            >
              <ChevronLeft size={14} />
              Previous week
            </Button>
            <Button
              size="sm"
              variant="flat"
              className="border border-white/10 bg-black/20 text-foreground"
              onPress={() => void handleWeekChange(format(new Date(), "yyyy-MM-dd"))}
            >
              This week
            </Button>
            <Button
              size="sm"
              variant="flat"
              className="border border-white/10 bg-black/20 text-foreground"
              onPress={() => currentWeekStart && void handleWeekChange(format(addWeeks(currentWeekStart, 1), "yyyy-MM-dd"))}
            >
              Next week
              <ChevronRight size={14} />
            </Button>
            {summary.weekly.isPartial && (
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] uppercase tracking-[0.12em] text-amber-300">
                Partial week
              </span>
            )}
          </div>
        </div>
      </div>

      {loading ? <TimeLoggingSkeleton /> : null}

      {!loading && (
        <>
          {activeTab === "weekly" && weeklyMetrics && (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  label="Logged this week"
                  value={formatHours(summary.weekly.actualTotalHours)}
                  detail={`${formatHours(summary.weekly.actualTotalHours)} vs ${formatHours(summary.weekly.idealTotalHours)} ideal`}
                />
                <MetricCard
                  label="Delta vs ideal"
                  value={formatHours(summary.weekly.actualTotalHours - summary.weekly.idealTotalHours)}
                  detail={summary.weekly.actualTotalHours >= summary.weekly.idealTotalHours ? "Over target" : "Under target"}
                  accent={summary.weekly.actualTotalHours >= summary.weekly.idealTotalHours ? "warm" : "cool"}
                />
                <MetricCard
                  label="Categories on target"
                  value={String(weeklyMetrics.onTargetCount)}
                  detail={`Within ±${ON_TARGET_TOLERANCE_HOURS}h of ideal`}
                />
                <MetricCard
                  label="Largest drift"
                  value={weeklyMetrics.largestUnder ? `${weeklyMetrics.largestUnder.category}` : "—"}
                  detail={[
                    weeklyMetrics.largestUnder
                      ? `Under: ${weeklyMetrics.largestUnder.category} (${formatHours(weeklyMetrics.largestUnder.deltaHours)})`
                      : null,
                    weeklyMetrics.largestOver
                      ? `Over: ${weeklyMetrics.largestOver.category} (+${formatHours(weeklyMetrics.largestOver.deltaHours)})`
                      : null,
                  ].filter(Boolean).join(" · ") || "No drift yet"}
                />
              </div>

              <CardShell
                title="Actual vs ideal by category"
                subtitle="Sorted by largest drift so it’s obvious where the week is off-plan."
                footer={summary.weekly.byCategory.length > 0 ? (
                  <div className="text-xs text-foreground-400">
                    Most under target: {summary.weekly.byCategory.filter((entry) => entry.deltaHours < 0).slice(0, 3).map((entry) => `${entry.category} (${formatHours(entry.deltaHours)})`).join(", ") || "—"}
                    <br />
                    Most over target: {summary.weekly.byCategory.filter((entry) => entry.deltaHours > 0).slice(0, 3).map((entry) => `${entry.category} (+${formatHours(entry.deltaHours)})`).join(", ") || "—"}
                  </div>
                ) : null}
              >
                <div style={{ height: Math.max(340, weeklyComparisonData.length * 34) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weeklyComparisonData} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
                      <CartesianGrid stroke="rgba(255,255,255,0.08)" horizontal={false} />
                      <XAxis type="number" stroke="rgba(255,255,255,0.45)" tickFormatter={(value) => `${value}h`} />
                      <YAxis type="category" dataKey="category" stroke="rgba(255,255,255,0.6)" width={120} tick={{ fontSize: 12 }} />
                      <Tooltip
                        cursor={{ fill: "rgba(255,255,255,0.04)" }}
                        formatter={((value: unknown, name: unknown) => [formatHours(Number(value ?? 0)), name === "actualHours" ? "Actual" : name === "idealHours" ? "Ideal" : "Delta"]) as never}
                      />
                      <Legend />
                      <ReferenceLine x={0} stroke="rgba(255,255,255,0.15)" />
                      <Bar dataKey="idealHours" name="Ideal" fill="rgba(255,255,255,0.25)" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="actualHours" name="Actual" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardShell>

              <div className="grid gap-4 xl:grid-cols-2">
                <CardShell title="Last 8 weeks" subtitle="Weekly composition and total logged time.">
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={weeklyStackData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                        <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                        <XAxis dataKey="shortLabel" stroke="rgba(255,255,255,0.45)" />
                        <YAxis stroke="rgba(255,255,255,0.45)" tickFormatter={(value) => `${value}h`} />
                        <Tooltip
                          formatter={((value: unknown, name: unknown) => [formatHours(Number(value ?? 0)), String(name)]) as never}
                          labelFormatter={(_, payload) => payload?.[0]?.payload?.label ? formatWeekLabel(String(payload[0].payload.label)) : "Week"}
                        />
                        {weekStackCategories.map((category) => (
                          <Bar key={category} dataKey={category} stackId="week" fill={getCategoryColor(category)} radius={[2, 2, 0, 0]}>
                            {weeklyStackData.map((entry, index) => (
                              <Cell
                                key={`${category}-${index}`}
                                fill={String(entry.label) === summary.weekly.selectedWeek ? getCategoryColor(category) : `${getCategoryColor(category)}CC`}
                                onClick={() => void handleWeekChange(String(entry.label))}
                              />
                            ))}
                          </Bar>
                        ))}
                        {weeklyStackData.some((entry) => Number(entry.Other ?? 0) > 0) && (
                          <Bar dataKey="Other" stackId="week" fill="rgba(255,255,255,0.18)">
                            {weeklyStackData.map((entry, index) => (
                              <Cell key={`other-${index}`} fill={String(entry.label) === summary.weekly.selectedWeek ? "rgba(255,255,255,0.32)" : "rgba(255,255,255,0.18)"} onClick={() => void handleWeekChange(String(entry.label))} />
                            ))}
                          </Bar>
                        )}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardShell>

                <CardShell title="Selected week by day" subtitle="Spot how categories cluster across the week.">
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dailyStackData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                        <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                        <XAxis dataKey="shortLabel" stroke="rgba(255,255,255,0.45)" />
                        <YAxis stroke="rgba(255,255,255,0.45)" tickFormatter={(value) => `${value}h`} />
                        <Tooltip
                          formatter={((value: unknown, name: unknown) => [formatHours(Number(value ?? 0)), String(name)]) as never}
                          labelFormatter={(_, payload) => payload?.[0]?.payload?.label ? format(parseISO(`${String(payload[0].payload.label)}T00:00:00`), "EEEE, MMM d") : "Day"}
                        />
                        {dailyStackCategories.map((category) => (
                          <Bar key={category} dataKey={category} stackId="day" fill={getCategoryColor(category)} radius={[2, 2, 0, 0]} />
                        ))}
                        {dailyStackData.some((entry) => Number(entry.Other ?? 0) > 0) && (
                          <Bar dataKey="Other" stackId="day" fill="rgba(255,255,255,0.18)" />
                        )}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardShell>
              </div>

              <CardShell title="Category detail" subtitle="Exact weekly numbers for copy/paste and close reading.">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-[0.12em] text-foreground-400">
                        <th className="px-3 py-2">Category</th>
                        <th className="px-3 py-2">Actual</th>
                        <th className="px-3 py-2">Ideal</th>
                        <th className="px-3 py-2">Delta</th>
                        <th className="px-3 py-2">Share</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.weekly.byCategory.map((entry) => (
                        <tr key={entry.category} className="border-b border-white/5 text-foreground-300 last:border-b-0">
                          <td className="px-3 py-2 font-medium text-foreground">{entry.category}</td>
                          <td className="px-3 py-2">{formatHours(entry.actualHours)}</td>
                          <td className="px-3 py-2">{entry.idealHours !== null ? formatHours(entry.idealHours) : "—"}</td>
                          <td className={`px-3 py-2 ${entry.deltaHours > 0 ? "text-amber-300" : entry.deltaHours < 0 ? "text-sky-300" : "text-foreground-300"}`}>
                            {entry.deltaHours > 0 ? "+" : ""}
                            {formatHours(entry.deltaHours)}
                          </td>
                          <td className="px-3 py-2">{formatPercent(entry.shareOfWeek)}</td>
                          <td className="px-3 py-2">
                            <span className="rounded-full border border-white/10 px-2 py-1 text-[11px] uppercase tracking-[0.1em] text-foreground-400">
                              {!entry.hasTarget ? "No target" : Math.abs(entry.deltaHours) <= ON_TARGET_TOLERANCE_HOURS ? "On target" : entry.deltaHours > 0 ? "Over" : "Under"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardShell>
            </div>
          )}

          {activeTab === "monthly" && (
            <div className="space-y-4">
              <div className="rounded-md border border-white/10 bg-[#111111] p-4">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    {[6, 12, 18, 24].map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setMonthRange(value as MonthRange)}
                        className={`rounded border px-3 py-1.5 text-sm transition ${
                          monthRange === value
                            ? "border-white/20 bg-white/10 text-white"
                            : "border-white/10 bg-black/20 text-foreground-400 hover:text-foreground"
                        }`}
                      >
                        Last {value} months
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setIncludePartialMonth((current) => !current)}
                      className={`rounded border px-3 py-1.5 text-sm transition ${
                        includePartialMonth
                          ? "border-white/20 bg-white/10 text-white"
                          : "border-white/10 bg-black/20 text-foreground-400 hover:text-foreground"
                      }`}
                    >
                      {includePartialMonth ? "Including partial month" : "Exclude partial month"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setMonthMode((current) => (current === "hours" ? "share" : "hours"))}
                      className="rounded border border-white/10 bg-black/20 px-3 py-1.5 text-sm text-foreground-300"
                    >
                      {monthMode === "hours" ? "Hours" : "% of month"}
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="flat" className="border border-white/10 bg-black/20 text-foreground" onPress={() => setSelectedCategories(filteredCategories.map((category) => category.canonicalName))}>
                      Select all
                    </Button>
                    <Button size="sm" variant="flat" className="border border-white/10 bg-black/20 text-foreground" onPress={() => setSelectedCategories([])}>
                      Clear all
                    </Button>
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-3">
                  <Input
                    size="sm"
                    value={categoryQuery}
                    onValueChange={setCategoryQuery}
                    placeholder="Search categories"
                    startContent={<Search size={14} className="text-foreground-400" />}
                    classNames={{
                      inputWrapper: "border border-white/10 bg-black/20",
                    }}
                  />
                  <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto pr-1">
                    {filteredCategories.map((category) => {
                      const isSelected = selectedCategories.includes(category.canonicalName);
                      return (
                        <button
                          key={category.canonicalName}
                          type="button"
                          onClick={() => setSelectedCategories((current) => current.includes(category.canonicalName)
                            ? current.filter((value) => value !== category.canonicalName)
                            : [...current, category.canonicalName])}
                          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition ${
                            isSelected
                              ? "border-white/20 bg-white/10 text-white"
                              : "border-white/10 bg-black/20 text-foreground-400 hover:text-foreground"
                          }`}
                        >
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: getCategoryColor(category.canonicalName) }} />
                          {category.canonicalName}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <CardShell title="Monthly total hours" subtitle="Context for whether category shifts are real or just total-volume changes.">
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyTotalData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                      <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                      <XAxis dataKey="label" stroke="rgba(255,255,255,0.45)" tick={{ fontSize: 12 }} />
                      <YAxis stroke="rgba(255,255,255,0.45)" tickFormatter={(value) => `${value}h`} />
                      <Tooltip formatter={((value: unknown) => [formatHours(Number(value ?? 0)), "Total hours"]) as never} />
                      <Bar dataKey="totalHours" radius={[4, 4, 0, 0]}>
                        {monthlyTotalData.map((entry) => (
                          <Cell key={entry.label} fill={entry.isPartial ? "rgba(139,92,246,0.45)" : "#8b5cf6"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardShell>

              <CardShell title="Category trends" subtitle={monthMode === "hours" ? "Track category hours across months." : "Track each category as a share of the month."}>
                {selectedCategories.length === 0 ? (
                  <div className="flex h-72 items-center justify-center rounded-md border border-dashed border-white/10 text-sm text-foreground-400">
                    Pick one or more categories to draw the trend lines.
                  </div>
                ) : (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={monthlyTrendData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                        <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                        <XAxis dataKey="label" stroke="rgba(255,255,255,0.45)" tick={{ fontSize: 12 }} />
                        <YAxis stroke="rgba(255,255,255,0.45)" tickFormatter={(value) => monthMode === "hours" ? `${value}h` : `${value}%`} />
                        <Tooltip
                          formatter={((value: unknown, name: unknown) => {
                            const numericValue = Number(value ?? 0);
                            return [monthMode === "hours" ? formatHours(numericValue) : `${numericValue.toFixed(1).replace(/\.0$/, "")}%`, String(name)];
                          }) as never}
                        />
                        <Legend />
                        {selectedCategories.map((category) => (
                          <Line
                            key={category}
                            type="monotone"
                            dataKey={category}
                            stroke={getCategoryColor(category)}
                            strokeWidth={2}
                            dot={{ r: 2 }}
                            activeDot={{ r: 4 }}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardShell>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CardShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="rounded-md border border-white/10 bg-[#111111] p-4">
      <div className="mb-4 flex flex-col gap-1">
        <div className="text-sm font-semibold text-foreground">{title}</div>
        {subtitle ? <div className="text-sm text-foreground-400">{subtitle}</div> : null}
      </div>
      {children}
      {footer ? <div className="mt-4 border-t border-white/10 pt-3">{footer}</div> : null}
    </section>
  );
}

function MetricCard({
  label,
  value,
  detail,
  accent = "neutral",
}: {
  label: string;
  value: string;
  detail: string;
  accent?: "neutral" | "warm" | "cool";
}) {
  return (
    <div className="rounded-md border border-white/10 bg-[#111111] p-4">
      <div className="text-[11px] uppercase tracking-[0.12em] text-foreground-400">{label}</div>
      <div className={`mt-2 text-2xl font-semibold ${accent === "warm" ? "text-amber-300" : accent === "cool" ? "text-sky-300" : "text-foreground"}`}>
        {value}
      </div>
      <div className="mt-2 text-sm text-foreground-400">{detail}</div>
    </div>
  );
}
