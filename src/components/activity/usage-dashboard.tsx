"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Select, SelectItem } from "@heroui/react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Zap, DollarSign, Users, TrendingUp } from "lucide-react";
import { formatLocalTime as formatLocalTimeShared } from "@/lib/dates";

interface Summary {
  total_input_tokens: number;
  total_output_tokens: number;
  total_tokens: number;
  total_cost_usd: number;
  active_agents: number;
  period_days: number;
  unpriced_requests?: number;
  unpriced_tokens?: number;
}

interface ChartRow {
  date: string;
  agent: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
}

interface BreakdownRow {
  agent: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  cost_source?: "exact" | "partial" | "unpriced";
  requests: number;
}

interface LogRow {
  id: string | number;
  agent: string;
  model: string | null;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  cost_source?: "exact" | "partial" | "unpriced" | "none";
  session_key: string | null;
  session_id?: string | null;
  session_type?: string | null;
  source: string;
  status: string;
  display_name?: string | null;
  label?: string | null;
  context_tokens?: number | null;
  total_tokens?: number | null;
  fullness_pct?: number | null;
  created_at: string | null;
  updated_at?: string | null;
}

// Muted dark-mode colors for each agent
const AGENT_COLORS: Record<string, string> = {
  frank: "#6366f1",   // indigo
  tom: "#8b5cf6",     // violet
  michael: "#06b6d4", // cyan
  joanna: "#a78bfa",  // light purple
  derrick: "#64748b", // slate
};


const PERIOD_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "7d", label: "7 days" },
  { value: "14d", label: "14 days" },
  { value: "30d", label: "30 days" },
] as const;

type PeriodKey = typeof PERIOD_OPTIONS[number]["value"];

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
    <div className="rounded border border-[#333333] bg-[#111111] p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs uppercase text-[#888888] tracking-wider">{label}</span>
        <span className="text-[#555555]">{icon}</span>
      </div>
      <p className="text-2xl font-mono text-white">{value}</p>
      {sub && <p className="text-xs text-[#555555] mt-1 font-mono">{sub}</p>}
    </div>
  );
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  interval?: string;
}

function CustomTooltip({ active, payload, label, interval }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const displayLabel = formatTooltipLabel(label || "", interval || "day");

  return (
    <div className="rounded border border-[#333333] bg-[#080808] p-2 text-xs font-mono">
      <p className="text-[#888888] mb-1">{displayLabel}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-[#CCCCCC] capitalize">{entry.dataKey}</span>
          <span className="text-white ml-auto">{formatTokens(entry.value)}</span>
        </div>
      ))}
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
  const [summary, setSummary] = useState<Summary | null>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [breakdown, setBreakdown] = useState<BreakdownRow[]>([]);
  const [recentLogs, setRecentLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const resolvedRange = useMemo(() => resolveRange(period), [period]);
  // Auto-derived interval based on period
  const interval = useMemo(() => intervalForPeriod(period), [period]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const tzOffset = getTzOffset();
      const range = resolvedRange;
      const rangeParams = `start=${encodeURIComponent(range.startIso)}&end=${encodeURIComponent(range.endIso)}`;

      const [summaryRes, chartRes, breakdownRes, logRes] = await Promise.all([
        fetch(`/api/mc/usage/summary?${rangeParams}`),
        fetch(`/api/mc/usage/chart?${rangeParams}&interval=${interval}&tzOffset=${tzOffset}`),
        fetch(`/api/mc/usage/breakdown?${rangeParams}`),
        fetch(`/api/mc/usage/log?limit=40`),
      ]);

      const summaryData = await summaryRes.json();
      const chartRows: ChartRow[] = await chartRes.json();
      const breakdownData = await breakdownRes.json();
      const logData = await logRes.json();

      setSummary(summaryData);
      setBreakdown(Array.isArray(breakdownData) ? breakdownData : []);
      setRecentLogs(Array.isArray(logData) ? logData : []);

      // Transform chart data: pivot agent rows into { date, frank: N, tom: N, ... }
      const dateMap = new Map<string, Record<string, number>>();

      // For hourly view, pre-seed a continuous local-hour series so Recharts
      // always gets contiguous X-axis points (even when an hour has zero usage).
      if (interval === "hour") {
        const startHour = new Date(range.start);
        startHour.setMinutes(0, 0, 0);

        const endExclusive = new Date(range.end);
        const endHour = new Date(endExclusive.getTime() - 1);
        endHour.setMinutes(0, 0, 0);

        const cursor = new Date(startHour);
        while (cursor <= endHour) {
          dateMap.set(formatHourKey(cursor), { date: formatHourKey(cursor) } as any);
          cursor.setHours(cursor.getHours() + 1);
        }
      }

      for (const row of chartRows) {
        if (!dateMap.has(row.date)) {
          dateMap.set(row.date, { date: row.date } as any);
        }
        const entry = dateMap.get(row.date)!;
        entry[row.agent] = (entry[row.agent] || 0) + row.input_tokens + row.output_tokens;
      }

      const chartAgents = Array.from(new Set(chartRows.map((r) => r.agent)));
      for (const entry of dateMap.values()) {
        for (const agent of chartAgents) {
          if (entry[agent] === undefined) entry[agent] = 0;
        }
      }

      setChartData(Array.from(dateMap.values()));
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

  return (
    <div className="mx-auto flex h-full max-w-[1200px] flex-col gap-4 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} strokeWidth={1.5} className="text-[#888888]" />
          <span className="text-[11px] font-medium uppercase tracking-wider text-[#888888]">Model Usage</span>
          {summary?.unpriced_requests ? (
            <span className="text-[10px] text-amber-300">
              {summary.unpriced_requests} unpriced
            </span>
          ) : null}
          {lastUpdatedAt ? (
            <span className="text-[10px] text-[#555555]">Updated {lastUpdatedAt.toLocaleTimeString()}</span>
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
          classNames={{ trigger: "border-[#222222] bg-[#080808] h-8 min-h-8" }}
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
            <div key={i} className="rounded border border-[#333333] bg-[#111111] p-4">
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
            sub={`${formatTokens(summary.total_input_tokens)} in · ${formatTokens(summary.total_output_tokens)} out`}
            icon={<Zap size={14} strokeWidth={1.5} />}
          />
          <MetricCard
            label="Est. Cost"
            value={formatCost(summary.total_cost_usd)}
            sub={`${summary.period_days}d period`}
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
              : (summary.period_days > 0 ? formatTokens(Math.round(summary.total_tokens / summary.period_days)) : "0")}
            sub={interval === "hour" ? "tokens/hour" : "tokens/day"}
            icon={<TrendingUp size={14} strokeWidth={1.5} />}
          />
        </div>
      ) : null}

      {/* Chart */}
      <div className="rounded border border-[#222222] bg-[#0A0A0A] p-4">
        <p className="text-xs text-[#888888] mb-3 uppercase tracking-wider">
          Token Usage by Agent
          <span className="text-[#555555]"> · {INTERVAL_LABELS[interval] || interval}</span>
        </p>
        {chartData.length === 0 ? (
          <div className="flex h-48 items-center justify-center">
            <p className="text-xs text-[#555555]">
              {loading ? "Loading..." : "No usage data yet. Data will accumulate as agents work."}
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
              <CartesianGrid stroke="#333333" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: "#888888", fontSize: 11, fontFamily: "monospace" }}
                axisLine={{ stroke: "#333333" }}
                tickLine={false}
                tickFormatter={(v) => formatChartDate(v, interval)}
              />
              <YAxis
                tick={{ fill: "#888888", fontSize: 11, fontFamily: "monospace" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={formatTokens}
              />
              <Tooltip content={<CustomTooltip interval={interval} />} />
              <Legend
                wrapperStyle={{ fontSize: "11px", fontFamily: "monospace" }}
                formatter={(value: string) => (
                  <span className="capitalize text-[#888888]">{value}</span>
                )}
              />
              {agents.map((agent) => (
                <Area
                  key={agent}
                  type="monotone"
                  dataKey={agent}
                  stackId="tokens"
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
      <div className="rounded border border-[#222222] bg-[#0A0A0A]">
        <div className="border-b border-[#222222] px-4 py-2.5">
          <p className="text-xs text-[#888888] uppercase tracking-wider">Usage Breakdown</p>
        </div>
        {breakdown.length === 0 ? (
          <div className="flex h-24 items-center justify-center">
            <p className="text-xs text-[#555555]">No usage data yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#222222] text-left text-xs text-[#888888]">
                  <th className="px-4 py-2 font-medium">Agent</th>
                  <th className="px-4 py-2 font-medium">Model</th>
                  <th className="px-4 py-2 font-medium text-right">Input</th>
                  <th className="px-4 py-2 font-medium text-right">Output</th>
                  <th className="px-4 py-2 font-medium text-right">Requests</th>
                  <th className="px-4 py-2 font-medium text-right">Est. Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1A1A1A]">
                {breakdown.map((row) => {
                  return (
                    <tr key={`${row.agent}-${row.model}`} className="hover:bg-[#111111] transition-colors">
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: AGENT_COLORS[row.agent] || "#888888" }}
                          />
                          <span className="capitalize text-white">{row.agent}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2 font-mono text-xs text-[#CCCCCC]">{row.model}</td>
                      <td className="px-4 py-2 text-right font-mono text-xs text-[#CCCCCC]">
                        {formatTokens(row.input_tokens)}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-xs text-[#CCCCCC]">
                        {formatTokens(row.output_tokens)}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-xs text-[#CCCCCC]">
                        {row.requests}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-xs text-white">
                        {row.cost_source === "unpriced" ? (
                          <span className="text-amber-300">unpriced</span>
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

      {/* Recent Sessions Table */}
      <div className="rounded border border-[#222222] bg-[#0A0A0A]">
        <div className="border-b border-[#222222] px-4 py-2.5">
          <p className="text-xs text-[#888888] uppercase tracking-wider">Recent Sessions</p>
        </div>
        {recentLogs.length === 0 ? (
          <div className="flex h-16 items-center justify-center">
            <p className="text-xs text-[#555555]">No recent sessions</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#222222] text-left text-[10px] text-[#666666] uppercase tracking-wider">
                  <th className="px-4 py-1.5 font-medium">Time</th>
                  <th className="px-4 py-1.5 font-medium">Agent</th>
                  <th className="px-4 py-1.5 font-medium">Session</th>
                  <th className="px-4 py-1.5 font-medium">Source</th>
                  <th className="px-4 py-1.5 font-medium">Status</th>
                  <th className="px-4 py-1.5 font-medium">Model</th>
                  <th className="px-4 py-1.5 font-medium text-right">Context</th>
                  <th className="px-4 py-1.5 font-medium text-right">Input</th>
                  <th className="px-4 py-1.5 font-medium text-right">Output</th>
                  <th className="px-4 py-1.5 font-medium text-right">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#161616]">
                {recentLogs.map((row) => {
                  const sessionLabel = row.display_name || row.label || row.session_key || row.session_id || "-";
                  const rawStatus = String(row.status || "unknown").toLowerCase();
                  const statusLabel = rawStatus.startsWith("active")
                    ? "Active"
                    : rawStatus.includes("inactive")
                      ? "Inactive"
                      : rawStatus === "deleted" || rawStatus === "reset"
                        ? "Reset"
                        : rawStatus === "expired"
                          ? "Expired"
                          : rawStatus.replace(/[_-]+/g, " ");
                  const statusTone = rawStatus.startsWith("active")
                    ? "border border-green-500/25 bg-green-500/10 text-green-300"
                    : rawStatus === "deleted" || rawStatus === "reset"
                      ? "border border-amber-500/25 bg-amber-500/10 text-amber-300"
                      : rawStatus === "expired"
                        ? "border border-[#3a3a3a] bg-[#222222] text-[#999999]"
                        : "border border-[#3a3a3a] bg-[#1f1f1f] text-[#b0b0b0]";

                  return (
                    <tr key={row.id} className="hover:bg-[#0D0D0D] transition-colors">
                      <td className="px-4 py-1 text-xs font-mono text-[#666666]">
                        {row.created_at ? formatLocalTime(row.created_at) : "-"}
                      </td>
                      <td className="px-4 py-1">
                        <div className="flex items-center gap-1.5">
                          <div
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: AGENT_COLORS[row.agent] || "#888888" }}
                          />
                          <span className="text-xs text-[#CCCCCC] capitalize">{row.agent || "-"}</span>
                        </div>
                      </td>
                      <td className="max-w-[280px] px-4 py-1 text-xs font-mono text-[#777777]" title={sessionLabel}>
                        <span className="block truncate">{sessionLabel}</span>
                      </td>
                      <td className="px-4 py-1 text-xs text-[#BBBBBB]">{row.source || row.session_type || "-"}</td>
                      <td className="px-4 py-1 text-xs">
                        <span className={`inline-flex items-center whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10px] font-medium ${statusTone}`}>
                          {statusLabel}
                        </span>
                      </td>
                      <td className="px-4 py-1 text-xs font-mono text-[#888888]">{row.model || "-"}</td>
                      <td className="px-4 py-1 text-right text-xs">
                        {row.fullness_pct != null && row.total_tokens != null && row.context_tokens ? (
                          <div className="inline-flex items-center justify-end gap-2" title={`${formatTokens(row.total_tokens)} / ${formatTokens(row.context_tokens)} (${row.fullness_pct.toFixed(1)}%)`}>
                            <div className="h-1 w-14 overflow-hidden rounded-full bg-[#222222]">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${Math.min(Math.max(row.fullness_pct, 0), 100)}%`,
                                  backgroundColor: row.fullness_pct > 85 ? "#ef4444" : row.fullness_pct > 60 ? "#f59e0b" : "#8b5cf6",
                                }}
                              />
                            </div>
                            <span className="w-10 text-right font-mono text-[#CCCCCC]">{Math.round(row.fullness_pct)}%</span>
                          </div>
                        ) : (
                          <span className="font-mono text-[#555555]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-1 text-right text-xs font-mono text-[#CCCCCC]">
                        {row.input_tokens ? formatTokens(row.input_tokens) : "-"}
                      </td>
                      <td className="px-4 py-1 text-right text-xs font-mono text-[#888888]">
                        {row.output_tokens ? formatTokens(row.output_tokens) : "-"}
                      </td>
                      <td className="px-4 py-1 text-right text-xs font-mono text-[#888888]">
                        {row.cost_source === "none" ? (
                          <span className="text-[#555555]">-</span>
                        ) : row.cost_source === "unpriced" ? (
                          <span className="text-amber-300">unpriced</span>
                        ) : (
                          formatCost(row.cost_usd || 0)
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
    </div>
  );
}
