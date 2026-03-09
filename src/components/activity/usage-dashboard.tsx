"use client";

import { useState, useEffect, useCallback } from "react";
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

interface Summary {
  total_input_tokens: number;
  total_output_tokens: number;
  total_tokens: number;
  total_cost_usd: number;
  active_agents: number;
  period_days: number;
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
  requests: number;
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
  { value: "1", label: "Today" },
  { value: "7", label: "7 days" },
  { value: "14", label: "14 days" },
  { value: "30", label: "30 days" },
];

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatCost(n: number): string {
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

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
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded border border-[#333333] bg-[#080808] p-2 text-xs font-mono">
      <p className="text-[#888888] mb-1">{label}</p>
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

export function UsageDashboard() {
  const [days, setDays] = useState("7");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [breakdown, setBreakdown] = useState<BreakdownRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryRes, chartRes, breakdownRes] = await Promise.all([
        fetch(`/api/mc/usage/summary?days=${days}`),
        fetch(`/api/mc/usage/chart?days=${days}`),
        fetch(`/api/mc/usage/breakdown?days=${days}`),
      ]);

      const summaryData = await summaryRes.json();
      const chartRows: ChartRow[] = await chartRes.json();
      const breakdownData = await breakdownRes.json();

      setSummary(summaryData);
      setBreakdown(Array.isArray(breakdownData) ? breakdownData : []);

      // Transform chart data: pivot agent rows into { date, frank: N, tom: N, ... }
      const dateMap = new Map<string, Record<string, number>>();
      for (const row of chartRows) {
        if (!dateMap.has(row.date)) {
          dateMap.set(row.date, { date: row.date } as any);
        }
        const entry = dateMap.get(row.date)!;
        entry[row.agent] = (entry[row.agent] || 0) + row.input_tokens + row.output_tokens;
      }
      setChartData(Array.from(dateMap.values()));
    } catch (err) {
      console.error("Failed to fetch usage data:", err);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Get unique agents from chart data for the stacked areas
  const agents = Array.from(
    new Set(breakdown.map((r) => r.agent))
  ).sort();

  return (
    <div className="mx-auto flex h-full max-w-[1200px] flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} strokeWidth={1.5} className="text-[#888888]" />
          <span className="text-sm font-medium">Model Usage</span>
        </div>
        <Select
          selectedKeys={[days]}
          onSelectionChange={(keys) => {
            const v = Array.from(keys)[0] as string;
            if (v) setDays(v);
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
            label="Avg / Day"
            value={summary.period_days > 0 ? formatTokens(Math.round(summary.total_tokens / summary.period_days)) : "0"}
            sub="tokens"
            icon={<TrendingUp size={14} strokeWidth={1.5} />}
          />
        </div>
      ) : null}

      {/* Chart */}
      <div className="rounded border border-[#222222] bg-[#0A0A0A] p-4">
        <p className="text-xs text-[#888888] mb-3 uppercase tracking-wider">Token Usage by Agent</p>
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
                tickFormatter={(v) => {
                  const d = new Date(v + "T00:00:00");
                  return `${d.getMonth() + 1}/${d.getDate()}`;
                }}
              />
              <YAxis
                tick={{ fill: "#888888", fontSize: 11, fontFamily: "monospace" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={formatTokens}
              />
              <Tooltip content={<CustomTooltip />} />
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
                {breakdown.map((row, i) => (
                  <tr key={i} className="hover:bg-[#111111] transition-colors">
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
                      {formatCost(row.cost_usd)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
