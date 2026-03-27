"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Select, SelectItem, Tooltip } from "@heroui/react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Zap, DollarSign, Users, TrendingUp, CircleHelp } from "lucide-react";
import { formatLocalTime as formatLocalTimeShared } from "@/lib/dates";
import { useTheme } from "next-themes";
import { SessionsBrowser } from "@/components/activity/sessions-browser";

interface Summary {
  total_input_tokens: number;
  total_cached_input_tokens?: number;
  total_output_tokens: number;
  total_tokens: number;
  total_cost_usd: number;
  active_agents: number;
  period_days: number;
  period_start_utc?: string;
  period_end_utc?: string;
  unpriced_requests?: number;
  unpriced_tokens?: number;
}

interface ChartRow {
  date: string;
  agent: string;
  input_tokens: number;
  cached_input_tokens?: number;
  output_tokens: number;
  cost_usd: number;
}

interface BreakdownRow {
  agent: string;
  model: string;
  input_tokens: number;
  cached_input_tokens?: number;
  output_tokens: number;
  cost_usd: number;
  cost_source?: "exact" | "partial" | "unpriced";
  requests: number;
}

// Muted colors for each agent
const AGENT_COLORS: Record<string, string> = {
  frank: "#6366f1",       // indigo
  tom: "#8b5cf6",         // violet
  michael: "#06b6d4",     // cyan
  joanna: "#a78bfa",      // light purple
  contractors: "#f59e0b", // amber
  derrick: "#64748b",     // slate
};


const PERIOD_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "7d", label: "7 days" },
  { value: "14d", label: "14 days" },
  { value: "30d", label: "30 days" },
] as const;

type PeriodKey = typeof PERIOD_OPTIONS[number]["value"];
type MetricKey = "tokens" | "cost";

interface ResolvedRange {
  start: Date;
  end: Date;
  startIso: string;
  endIso: string;
  periodDays: number;
}

/** Auto-select interval based on period */
function intervalForPeriod(period: PeriodKey): string {
  switch (period) {
    case "today":
    case "yesterday":
      return "hour";
    case "30d":
      return "week";
    default:
      return "day"; // 7d, 14d
  }
}

function startOfLocalDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addLocalDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function resolveRange(period: PeriodKey, now = new Date()): ResolvedRange {
  const todayStart = startOfLocalDay(now);

  let start: Date;
  let end: Date;
  let periodDays: number;

  switch (period) {
    case "today":
      start = todayStart;
      end = now;
      periodDays = 1;
      break;
    case "yesterday":
      start = addLocalDays(todayStart, -1);
      end = todayStart;
      periodDays = 1;
      break;
    case "14d":
      start = addLocalDays(todayStart, -13);
      end = now;
      periodDays = 14;
      break;
    case "30d":
      start = addLocalDays(todayStart, -29);
      end = now;
      periodDays = 30;
      break;
    case "7d":
    default:
      start = addLocalDays(todayStart, -6);
      end = now;
      periodDays = 7;
      break;
  }

  return {
    start,
    end,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    periodDays,
  };
}

/** Get client timezone offset in minutes (for backend SQL adjustment) */
function getTzOffset(): number {
  return new Date().getTimezoneOffset();
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatCost(n: number): string {
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

function getMetricDataKey(agent: string, metric: MetricKey): string {
  return `${agent}__${metric}`;
}

function formatHourKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  return `${y}-${m}-${d} ${h}:00`;
}

/** Parse a date string from the backend (already adjusted to local tz) into a display string */
function formatChartDate(v: string, interval: string): string {
  if (interval === "hour") {
    // "2026-03-09 14:00" → "2 PM"
    try {
      // This string is already in local time (backend adjusted), parse it directly
      const [, timePart] = v.split(" ");
      const hour = parseInt(timePart, 10);
      const ampm = hour >= 12 ? "PM" : "AM";
      const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      return `${h12} ${ampm}`;
    } catch {
      return v;
    }
  }
  if (interval === "week") {
    // "2026-W10" → "W10"
    const m = v.match(/W(\d+)/);
    return m ? `W${m[1]}` : v;
  }
  // "2026-03-09" → "3/9"
  try {
    const parts = v.split("-");
    return `${parseInt(parts[1], 10)}/${parseInt(parts[2], 10)}`;
  } catch {
    return v;
  }
}

/** Format tooltip label for the chart */
function formatTooltipLabel(v: string, interval: string): string {
  if (interval === "hour") {
    try {
      const [datePart, timePart] = v.split(" ");
      const hour = parseInt(timePart, 10);
      const nextHour = (hour + 1) % 24;
      const fmt = (h: number) => {
        const ampm = h >= 12 ? "PM" : "AM";
        const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
        return `${h12}:00 ${ampm}`;
      };
      const [y, m, d] = datePart.split("-");
      return `${parseInt(m, 10)}/${parseInt(d, 10)} ${fmt(hour)} – ${fmt(nextHour)}`;
    } catch {
      return v;
    }
  }
  if (interval === "week") {
    return `Week ${v}`;
  }
  // Daily
  try {
    const parts = v.split("-");
    return `${parseInt(parts[1], 10)}/${parseInt(parts[2], 10)}/${parts[0]}`;
  } catch {
    return v;
  }
}

/** Format a UTC timestamp to local time string */
const formatLocalTime = formatLocalTimeShared;

interface MetricCardProps {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
}

function MetricCard({ label, value, sub, icon }: MetricCardProps) {
  return (
    <div className="rounded border border-divider bg-white dark:bg-[#111111] p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs uppercase text-foreground-400 tracking-wider">{label}</span>
        <span className="text-foreground-300">{icon}</span>
      </div>
      <p className="text-2xl font-mono text-foreground dark:text-white">{value}</p>
      {sub && <p className="text-xs text-foreground-300 mt-1 font-mono">{sub}</p>}
    </div>
  );
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  interval?: string;
  metric: MetricKey;
}

function CustomTooltip({ active, payload, label, interval, metric }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const displayLabel = formatTooltipLabel(label || "", interval || "day");
  const formatValue = metric === "cost" ? formatCost : formatTokens;
  const totalValue = payload.reduce((acc, entry) => acc + Number(entry.value || 0), 0);

  return (
    <div className="rounded border border-divider bg-white dark:bg-[#080808] p-2 text-xs font-mono shadow-md min-w-[150px]">
      <p className="text-foreground-400 mb-2 border-b border-divider pb-1">{displayLabel}</p>

      <div className="flex flex-col gap-1.5 mb-2">
        {payload.map((entry: any, i: number) => (
          <div key={i} className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-foreground-500 dark:text-[#CCCCCC] capitalize">{entry.name || entry.dataKey}</span>
            <span className="text-foreground dark:text-white ml-auto">{formatValue(Number(entry.value || 0))}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 border-t border-divider pt-1.5 mt-1 font-semibold">
        <span className="text-foreground-400">Total</span>
        <span className="text-foreground dark:text-white ml-auto">{formatValue(totalValue)}</span>
      </div>
    </div>
  );
}

/** Interval label for the chart subtitle */
const INTERVAL_LABELS: Record<string, string> = {
  hour: "Hourly",
  day: "Daily",
  week: "Weekly",
};

export function UsageDashboard() {
  const [period, setPeriod] = useState<PeriodKey>("7d");
  const [metric, setMetric] = useState<MetricKey>("tokens");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [breakdown, setBreakdown] = useState<BreakdownRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const { theme } = useTheme();

  const resolvedRange = useMemo(() => resolveRange(period), [period]);
  // Auto-derived interval based on period
  const interval = useMemo(() => intervalForPeriod(period), [period]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const tzOffset = getTzOffset();
      const range = resolvedRange;
      const rangeParams = new URLSearchParams({
        start: range.startIso,
        end: range.endIso,
      });
      const summaryParams = new URLSearchParams(rangeParams);
      summaryParams.set("periodDays", String(range.periodDays));

      const [summaryRes, chartRes, breakdownRes] = await Promise.all([
        fetch(`/api/mc/usage/summary?${summaryParams.toString()}`),
        fetch(`/api/mc/usage/chart?${rangeParams.toString()}&interval=${interval}&tzOffset=${tzOffset}`),
        fetch(`/api/mc/usage/breakdown?${rangeParams.toString()}`),
      ]);

      const summaryData = await summaryRes.json();
      const chartRows: ChartRow[] = await chartRes.json();
      const breakdownData = await breakdownRes.json();

      setSummary(summaryData);
      setBreakdown(Array.isArray(breakdownData) ? breakdownData : []);

      // Transform chart data: pivot agent rows into
      // { date, frank__tokens: N, frank__cost: N, ... }
      const dateMap = new Map<string, any>();

      // For hourly view, pre-seed a continuous local-hour series so Recharts
      // always gets contiguous X-axis points (even when an hour has zero usage).
      if (interval === "hour") {
        // Use fixed local-hour bounds to keep the X-axis contiguous.
        const start = new Date(range.start);
        start.setMinutes(0, 0, 0);

        // For past full-day windows (Yesterday), range.end is exclusive (today 00:00),
        // so use end-1ms to anchor to yesterday 23:xx before rounding to hour.
        const endInclusive = period === "yesterday"
          ? new Date(range.end.getTime() - 1)
          : new Date(range.end);
        endInclusive.setMinutes(0, 0, 0);

        const cursor = new Date(start);
        // Safety limit to prevent infinite loops (max 31 days of hours)
        let safety = 0;
        while (cursor <= endInclusive && safety < 800) {
          const key = formatHourKey(cursor);
          dateMap.set(key, { date: key });
          cursor.setHours(cursor.getHours() + 1);
          safety++;
        }
      }

      for (const row of chartRows) {
        if (!dateMap.has(row.date)) {
          dateMap.set(row.date, { date: row.date });
        }

        const entry = dateMap.get(row.date)!;
        const cached = row.cached_input_tokens || 0;
        const tokenKey = getMetricDataKey(row.agent, "tokens");
        const costKey = getMetricDataKey(row.agent, "cost");

        entry[tokenKey] = (entry[tokenKey] || 0) + row.input_tokens + cached + row.output_tokens;
        entry[costKey] = (entry[costKey] || 0) + (row.cost_usd || 0);
      }

      const chartAgents = Array.from(new Set([
        ...chartRows.map((r) => r.agent),
        ...(Array.isArray(breakdownData) ? breakdownData.map((r: BreakdownRow) => r.agent) : []),
      ]));
      const sortedData = Array.from(dateMap.values())
        .sort((a, b) => String(a.date).localeCompare(String(b.date)));

      for (const entry of sortedData) {
        for (const agent of chartAgents) {
          const tokenKey = getMetricDataKey(agent, "tokens");
          const costKey = getMetricDataKey(agent, "cost");
          if (entry[tokenKey] === undefined) entry[tokenKey] = 0;
          if (entry[costKey] === undefined) entry[costKey] = 0;
        }
      }

      setChartData(sortedData);
    } catch (err) {
      console.error("Failed to fetch usage data:", err);
    } finally {
      setLastUpdatedAt(new Date());
      setLoading(false);
    }
  }, [resolvedRange, interval]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Get unique agents from chart data for the stacked areas
  const agents = Array.from(
    new Set(breakdown.map((r) => r.agent))
  ).sort();

  const chartColors = {
    grid: theme === "light" ? "#e5e7eb" : "#333333",
    text: theme === "light" ? "#9ca3af" : "#888888",
  };

  return (
    <div className="mx-auto flex h-full max-w-[1200px] flex-col gap-4 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} strokeWidth={1.5} className="text-foreground-400" />
          <span className="text-[11px] font-medium uppercase tracking-wider text-foreground-400">Model Usage</span>
          <Tooltip
            content={
              <div className="max-w-xs text-xs leading-relaxed">
                OpenClaw telemetry → usage-tracker hook → Mission Control usage_logs. Token totals include cached input; costs are estimated from non-cached input/output pricing.
                {summary?.period_start_utc && summary?.period_end_utc ? (
                  <div className="mt-1 text-foreground-300">
                    Window: {new Date(summary.period_start_utc).toLocaleString()} – {new Date(summary.period_end_utc).toLocaleString()}
                  </div>
                ) : null}
              </div>
            }
            placement="right"
          >
            <button className="text-foreground-300 hover:text-foreground-500" aria-label="Model usage info">
              <CircleHelp size={13} strokeWidth={1.75} />
            </button>
          </Tooltip>
          {summary?.unpriced_requests ? (
            <span className="text-[10px] text-warning-500">
              {summary.unpriced_requests} unpriced
            </span>
          ) : null}
          {lastUpdatedAt ? (
            <span className="text-[10px] text-foreground-300">Updated {lastUpdatedAt.toLocaleTimeString()}</span>
          ) : null}
        </div>
        <Select
          selectedKeys={[period]}
          onSelectionChange={(keys) => {
            const v = Array.from(keys)[0] as PeriodKey | undefined;
            if (v) setPeriod(v);
          }}
          variant="bordered"
          size="sm"
          className="max-w-[120px]"
          classNames={{ trigger: "border-divider bg-white dark:bg-[#080808] h-8 min-h-8" }}
        >
          {PERIOD_OPTIONS.map((p) => (
            <SelectItem key={p.value}>{p.label}</SelectItem>
          ))}
        </Select>
      </div>


      {/* Hero Cards */}
      {loading && !summary ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded border border-divider bg-white dark:bg-[#111111] p-4">
              <div className="skeleton h-3 w-20 mb-3" />
              <div className="skeleton h-7 w-24" />
            </div>
          ))}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard
            label="Total Tokens"
            value={formatTokens(summary.total_tokens)}
            sub={`${formatTokens(summary.total_input_tokens)} in · ${formatTokens(summary.total_cached_input_tokens || 0)} cached · ${formatTokens(summary.total_output_tokens)} out`}
            icon={<Zap size={14} strokeWidth={1.5} />}
          />
          <MetricCard
            label="Est. Cost"
            value={formatCost(summary.total_cost_usd)}
            sub={`${resolvedRange.periodDays}d period`}
            icon={<DollarSign size={14} strokeWidth={1.5} />}
          />
          <MetricCard
            label="Active Agents"
            value={String(summary.active_agents)}
            sub="last period"
            icon={<Users size={14} strokeWidth={1.5} />}
          />
          <MetricCard
            label="Burn Rate"
            value={interval === "hour"
              ? formatTokens(Math.round(summary.total_tokens / Math.max((resolvedRange.end.getTime() - resolvedRange.start.getTime()) / (60 * 60 * 1000), 1)))
              : (resolvedRange.periodDays > 0 ? formatTokens(Math.round(summary.total_tokens / resolvedRange.periodDays)) : "0")}
            sub={interval === "hour" ? "tokens/hour" : "tokens/day"}
            icon={<TrendingUp size={14} strokeWidth={1.5} />}
          />
        </div>
      ) : null}

      {/* Chart */}
      <div className="rounded border border-divider bg-white dark:bg-[#0A0A0A] p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-xs text-foreground-400 uppercase tracking-wider">
            {metric === "cost" ? "Cost" : "Token Usage"} by Agent
            <span className="text-foreground-300"> · {INTERVAL_LABELS[interval] || interval}</span>
          </p>
          <Select
            selectedKeys={[metric]}
            onSelectionChange={(keys) => {
              const v = Array.from(keys)[0] as MetricKey | undefined;
              if (v) setMetric(v);
            }}
            variant="bordered"
            size="sm"
            className="w-[100px] h-7 min-h-7"
            classNames={{
              trigger: "border-divider bg-transparent dark:bg-[#080808] h-7 min-h-7 px-2 rounded text-xs text-foreground-400 shadow-none",
              value: "text-xs text-foreground-400",
              popoverContent: "min-w-[100px]",
            }}
            disallowEmptySelection
          >
            <SelectItem key="tokens">Tokens</SelectItem>
            <SelectItem key="cost">Cost</SelectItem>
          </Select>
        </div>
        {chartData.length === 0 ? (
          <div className="flex h-48 items-center justify-center">
            <p className="text-xs text-foreground-300">
              {loading ? "Loading..." : "No usage data yet. Data will accumulate as agents work."}
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
              <CartesianGrid stroke={chartColors.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: chartColors.text, fontSize: 11, fontFamily: "monospace" }}
                axisLine={{ stroke: chartColors.grid }}
                tickLine={false}
                tickFormatter={(v) => formatChartDate(v, interval)}
              />
              <YAxis
                tick={{ fill: chartColors.text, fontSize: 11, fontFamily: "monospace" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={metric === "cost" ? formatCost : formatTokens}
              />
              <RechartsTooltip content={<CustomTooltip interval={interval} metric={metric} />} />
              <Legend
                wrapperStyle={{ fontSize: "11px", fontFamily: "monospace" }}
                formatter={(value: string) => (
                  <span className="capitalize text-foreground-400">{value}</span>
                )}
              />
              {agents.map((agent) => (
                <Area
                  key={agent}
                  type="monotone"
                  dataKey={getMetricDataKey(agent, metric)}
                  name={agent}
                  stackId={metric}
                  stroke={AGENT_COLORS[agent] || "#888888"}
                  fill={AGENT_COLORS[agent] || "#888888"}
                  fillOpacity={0.3}
                  strokeWidth={1.5}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Breakdown Table */}
      <div className="rounded border border-divider bg-white dark:bg-[#0A0A0A]">
        <div className="border-b border-divider px-4 py-2.5">
          <p className="text-xs text-foreground-400 uppercase tracking-wider">Usage Breakdown</p>
        </div>
        {breakdown.length === 0 ? (
          <div className="flex h-24 items-center justify-center">
            <p className="text-xs text-foreground-300">No usage data yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-divider text-left text-xs text-foreground-400">
                  <th className="px-4 py-2 font-medium">Agent</th>
                  <th className="px-4 py-2 font-medium">Model</th>
                  <th className="px-4 py-2 font-medium text-right">Input</th>
                  <th className="px-4 py-2 font-medium text-right">Cached</th>
                  <th className="px-4 py-2 font-medium text-right">Output</th>
                  <th className="px-4 py-2 font-medium text-right">Requests</th>
                  <th className="px-4 py-2 font-medium text-right">Est. Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider dark:divide-[#1A1A1A]">
                {breakdown.map((row) => {
                  return (
                    <tr key={`${row.agent}-${row.model}`} className="hover:bg-gray-50 dark:hover:bg-[#111111] transition-colors">
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: AGENT_COLORS[row.agent] || "#888888" }}
                          />
                          <span className="capitalize text-foreground dark:text-white">{row.agent}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2 font-mono text-xs text-foreground-500 dark:text-[#CCCCCC]">{row.model}</td>
                      <td className="px-4 py-2 text-right font-mono text-xs text-foreground-500 dark:text-[#CCCCCC]">
                        {formatTokens(row.input_tokens)}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-xs text-foreground-400">
                        {formatTokens(row.cached_input_tokens || 0)}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-xs text-foreground-500 dark:text-[#CCCCCC]">
                        {formatTokens(row.output_tokens)}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-xs text-foreground-500 dark:text-[#CCCCCC]">
                        {row.requests}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-xs text-foreground dark:text-white">
                        {row.cost_source === "unpriced" ? (
                          <span className="text-warning-500">unpriced</span>
                        ) : (
                          formatCost(row.cost_usd)
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <SessionsBrowser
        formatTokens={formatTokens}
        formatCost={formatCost}
        formatLocalTime={formatLocalTime}
        agentColors={AGENT_COLORS}
      />
    </div>
  );
}

