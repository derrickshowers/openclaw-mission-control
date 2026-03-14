"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal, ModalBody, ModalContent, ModalHeader, Select, SelectItem } from "@heroui/react";
import { Filter } from "lucide-react";
import ReactMarkdown from "react-markdown";

type DatePreset = "all" | "today" | "last7" | "last30" | "custom";

interface SessionListItem {
  session_ref: string;
  session_id: string | null;
  session_key: string | null;
  agent: string;
  model: string | null;
  model_label: string | null;
  model_family: string | null;
  source: string;
  session_type: string;
  status: string;
  display_name: string | null;
  label: string | null;
  last_activity_at: string | null;
  started_at: string | null;
  updated_at: string | null;
  detail_available: boolean;
  detail_source: "transcript" | "archive_snapshot" | "none";
  is_live: boolean;
  is_archived: boolean;
  llm_calls: number;
  input_tokens: number;
  cached_input_tokens: number;
  output_tokens: number;
  usage_total_tokens: number;
  cost_usd: number;
  cost_source: "exact" | "estimated" | "mixed" | "unpriced" | "none" | string;
  task_id?: string | null;
  task_title?: string | null;
  task_run_seq?: number | null;
  task_run_status?: string | null;
}

interface SessionsPage {
  items: SessionListItem[];
  pageInfo: {
    limit: number;
    returned: number;
    hasMore: boolean;
    nextCursor: string | null;
    totalCount: number;
  };
}

interface SessionFacets {
  agents: Array<{ id: string; label: string; count: number }>;
  models: Array<{ id: string; label: string; family: string | null; count: number }>;
  dateRange: { min: string | null; max: string | null };
}

interface SessionDetail {
  session: SessionListItem & Record<string, unknown>;
  thread: {
    items: ThreadItem[];
    pageInfo: {
      returned: number;
      hasMoreOlder: boolean;
      nextCursor: string | null;
    };
  };
}

interface ThreadItem {
  id: string;
  timestamp: string | null;
  kind: "message" | "tool_result" | "meta";
  role?: "user" | "assistant";
  eventType?: string;
  toolName?: string | null;
  toolCallId?: string | null;
  isError?: boolean;
  stopReason?: string | null;
  details?: unknown;
  parts: ThreadPart[];
  usage?: {
    input: number;
    output: number;
    cacheRead: number;
    totalTokens: number;
    costUsd: number;
  };
}

interface ThreadPart {
  type: "text" | "thinking" | "tool_call" | "json";
  text?: string;
  toolName?: string;
  arguments?: unknown;
  value?: unknown;
}

interface SessionsBrowserProps {
  formatTokens: (n: number) => string;
  formatCost: (n: number) => string;
  formatLocalTime: (v: string | null | undefined) => string;
  agentColors: Record<string, string>;
}

function safeJson(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function isSameDayLocal(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endExclusiveFromDateInput(dateInput: string): string | null {
  if (!dateInput) return null;
  const local = new Date(`${dateInput}T00:00:00`);
  if (Number.isNaN(local.getTime())) return null;
  local.setDate(local.getDate() + 1);
  return local.toISOString();
}

function formatRelative(ts: string | null): string {
  if (!ts) return "—";
  const t = Date.parse(ts);
  if (!Number.isFinite(t)) return "—";
  const diffMs = Date.now() - t;
  const abs = Math.abs(diffMs);
  const min = Math.round(abs / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  return `${day}d ago`;
}

function formatStopReason(stopReason: string | null | undefined): string | null {
  if (!stopReason) return null;
  const normalized = stopReason
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
  if (!normalized) return null;
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function SessionsBrowser({ formatTokens, formatCost, formatLocalTime, agentColors }: SessionsBrowserProps) {
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [pageInfo, setPageInfo] = useState<SessionsPage["pageInfo"] | null>(null);
  const [facets, setFacets] = useState<SessionFacets>({ agents: [], models: [], dateRange: { min: null, max: null } });

  const [agentFilter, setAgentFilter] = useState<string[]>([]);
  const [modelFilter, setModelFilter] = useState<string[]>([]);
  const [datePreset, setDatePreset] = useState<DatePreset>("last7");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const [selectedSession, setSelectedSession] = useState<SessionListItem | null>(null);
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailLoadingOlder, setDetailLoadingOlder] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const dateBounds = useMemo(() => {
    const now = new Date();
    if (datePreset === "all") {
      return { dateFrom: null as string | null, dateTo: null as string | null };
    }

    if (datePreset === "today") {
      const start = startOfLocalDay(now);
      return { dateFrom: start.toISOString(), dateTo: null as string | null };
    }

    if (datePreset === "last7") {
      const start = startOfLocalDay(now);
      start.setDate(start.getDate() - 6);
      return { dateFrom: start.toISOString(), dateTo: null as string | null };
    }

    if (datePreset === "last30") {
      const start = startOfLocalDay(now);
      start.setDate(start.getDate() - 29);
      return { dateFrom: start.toISOString(), dateTo: null as string | null };
    }

    const customStart = customFrom ? new Date(`${customFrom}T00:00:00`) : null;
    const fromIso = customStart && !Number.isNaN(customStart.getTime()) ? customStart.toISOString() : null;
    const toIso = endExclusiveFromDateInput(customTo);
    return {
      dateFrom: fromIso,
      dateTo: toIso,
    };
  }, [datePreset, customFrom, customTo]);

  const hasActiveFilters = agentFilter.length > 0
    || modelFilter.length > 0
    || datePreset !== "last7";

  const buildQuery = useCallback((opts?: { cursor?: string | null; forFacets?: boolean }) => {
    const params = new URLSearchParams();

    if (!opts?.forFacets) {
      params.set("limit", "25");
      if (opts?.cursor) params.set("cursor", opts.cursor);
    }

    if (agentFilter.length > 0) params.set("agents", agentFilter.join(","));
    if (modelFilter.length > 0) params.set("models", modelFilter.join(","));
    if (dateBounds.dateFrom) params.set("dateFrom", dateBounds.dateFrom);
    if (dateBounds.dateTo) params.set("dateTo", dateBounds.dateTo);
    params.set("hideLegacyDuplicates", "1");

    return params;
  }, [agentFilter, modelFilter, dateBounds.dateFrom, dateBounds.dateTo]);

  const loadFacets = useCallback(async () => {
    try {
      // Keep facets broad so selecting one option does not collapse the
      // available options list to only that current selection.
      const params = new URLSearchParams();
      if (dateBounds.dateFrom) params.set("dateFrom", dateBounds.dateFrom);
      if (dateBounds.dateTo) params.set("dateTo", dateBounds.dateTo);
      params.set("hideLegacyDuplicates", "1");

      const res = await fetch(`/api/mc/usage/sessions/facets?${params.toString()}`);
      if (!res.ok) throw new Error(`Failed to fetch facets (${res.status})`);
      const data = await res.json() as SessionFacets;
      setFacets({
        agents: Array.isArray(data.agents) ? data.agents : [],
        models: Array.isArray(data.models) ? data.models : [],
        dateRange: data.dateRange || { min: null, max: null },
      });
    } catch (e: any) {
      console.error("Failed to load session facets", e);
    }
  }, [dateBounds.dateFrom, dateBounds.dateTo]);

  const loadSessions = useCallback(async (opts?: { reset?: boolean; cursor?: string | null }) => {
    const isReset = opts?.reset ?? false;
    if (isReset) {
      setLoading(true);
      setError(null);
    } else {
      setLoadingMore(true);
    }

    try {
      const params = buildQuery({ cursor: opts?.cursor || null });
      const res = await fetch(`/api/mc/usage/sessions?${params.toString()}`);
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.error || `Failed to fetch sessions (${res.status})`);
      }

      const data = await res.json() as SessionsPage;
      const nextItems = Array.isArray(data.items) ? data.items : [];
      setSessions((prev) => {
        if (isReset) return nextItems;
        const existing = new Set(prev.map((row) => row.session_ref));
        const merged = [...prev];
        for (const row of nextItems) {
          if (!existing.has(row.session_ref)) merged.push(row);
        }
        return merged;
      });
      setPageInfo(data.pageInfo || null);
    } catch (e: any) {
      setError(String(e?.message || "Failed to load sessions"));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [buildQuery]);

  useEffect(() => {
    void loadFacets();
    void loadSessions({ reset: true });
  }, [loadFacets, loadSessions]);

  const openSessionDetail = useCallback(async (row: SessionListItem) => {
    if (!row.detail_available) return;
    setSelectedSession(row);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);

    try {
      const res = await fetch(`/api/mc/usage/sessions/${encodeURIComponent(row.session_ref)}?limit=200`);
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.error || `Failed to load session detail (${res.status})`);
      }
      const data = await res.json() as SessionDetail;
      setDetail(data);
    } catch (e: any) {
      setDetailError(String(e?.message || "Failed to load session detail"));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const loadOlderThreadItems = useCallback(async () => {
    if (!selectedSession || !detail?.thread?.pageInfo?.nextCursor) return;
    setDetailLoadingOlder(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", "200");
      params.set("cursor", detail.thread.pageInfo.nextCursor);

      const res = await fetch(`/api/mc/usage/sessions/${encodeURIComponent(selectedSession.session_ref)}?${params.toString()}`);
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.error || `Failed to load older messages (${res.status})`);
      }

      const data = await res.json() as SessionDetail;
      const olderItems = data.thread?.items || [];
      setDetail((prev) => {
        if (!prev) return data;
        const existingIds = new Set(prev.thread.items.map((item) => item.id));
        const mergedOlder = olderItems.filter((item) => !existingIds.has(item.id));
        return {
          ...prev,
          thread: {
            items: [...mergedOlder, ...prev.thread.items],
            pageInfo: data.thread.pageInfo,
          },
        };
      });
    } catch (e: any) {
      setDetailError(String(e?.message || "Failed to load older messages"));
    } finally {
      setDetailLoadingOlder(false);
    }
  }, [detail?.thread?.pageInfo?.nextCursor, selectedSession]);

  const resetFilters = useCallback(() => {
    setAgentFilter([]);
    setModelFilter([]);
    setDatePreset("last7");
    setCustomFrom("");
    setCustomTo("");
  }, []);

  const renderPart = useCallback((part: ThreadPart, idx: number) => {
    if (part.type === "tool_call") {
      return (
        <details
          key={`tool-call-${idx}`}
          className="rounded border border-divider bg-gray-50 p-2 text-xs font-mono text-foreground-600 dark:border-white/10 dark:bg-black/40 dark:text-gray-300"
        >
          <summary className="cursor-pointer list-none text-[11px] text-foreground-500 dark:text-gray-400">
            <span className="mr-1">⚙️</span>
            {part.toolName || "tool"}
          </summary>
          <pre className="mt-2 overflow-x-auto rounded border border-divider bg-white p-2 text-[11px] text-foreground-700 dark:border-white/10 dark:bg-black dark:text-gray-300">{safeJson(part.arguments)}</pre>
        </details>
      );
    }

    if (part.type === "json") {
      return (
        <pre key={`json-${idx}`} className="overflow-x-auto rounded border border-divider bg-white p-2 text-[11px] text-foreground-700 dark:border-white/10 dark:bg-black dark:text-gray-300">
          {safeJson(part.value)}
        </pre>
      );
    }

    const text = part.text || "";
    return (
      <div key={`text-${idx}`} className="leading-relaxed text-[13px] text-foreground dark:text-gray-100">
        <div className="prose prose-sm max-w-none prose-p:my-1 prose-pre:my-2 prose-pre:border prose-pre:border-divider prose-pre:bg-gray-50 prose-code:font-mono prose-code:text-[12px] prose-code:text-foreground-700 dark:prose-invert dark:prose-pre:border-white/10 dark:prose-pre:bg-black dark:prose-code:text-gray-200">
          <ReactMarkdown>{text}</ReactMarkdown>
        </div>
      </div>
    );
  }, []);

  const renderThreadItem = useCallback((item: ThreadItem) => {
    if (item.kind === "tool_result") {
      return (
        <div key={item.id} className="rounded border border-divider bg-gray-50/80 p-3 dark:border-white/10 dark:bg-black/40">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[11px] font-mono text-foreground-500 dark:text-gray-400">
              ⚙️ {item.toolName || "tool"} result
              {item.isError ? <span className="ml-2 text-red-500 dark:text-red-400">error</span> : null}
            </div>
            <span className="text-[10px] text-gray-500 dark:text-gray-500">{formatLocalTime(item.timestamp)}</span>
          </div>
          <details>
            <summary className="cursor-pointer text-[11px] text-foreground-500 dark:text-gray-400">Show payload</summary>
            <div className="mt-2 space-y-2">
              {item.parts.map(renderPart)}
              {item.details ? (
                <pre className="overflow-x-auto rounded border border-divider bg-white p-2 text-[11px] text-foreground-700 dark:border-white/10 dark:bg-black dark:text-gray-300">{safeJson(item.details)}</pre>
              ) : null}
            </div>
          </details>
        </div>
      );
    }

    if (item.kind === "meta") {
      return (
        <div key={item.id} className="rounded border border-divider bg-gray-50 p-2 text-[11px] text-foreground-500 dark:border-white/10 dark:bg-white/5 dark:text-gray-400">
          <div className="mb-1 flex items-center justify-between">
            <span className="font-mono uppercase tracking-wide">{item.eventType || "meta"}</span>
            <span>{formatLocalTime(item.timestamp)}</span>
          </div>
          <div className="space-y-2">{item.parts.map(renderPart)}</div>
        </div>
      );
    }

    const isUser = item.role === "user";
    const stopReasonLabel = formatStopReason(item.stopReason);

    return (
      <div key={item.id} className={`rounded border p-3 ${isUser ? "border-divider bg-gray-50/60 dark:border-white/10 dark:bg-white/5" : "border-transparent bg-transparent"}`}>
        <div className="mb-2 flex items-center justify-between">
          <span className={`text-[11px] font-medium uppercase tracking-wide ${isUser ? "text-foreground dark:text-gray-300" : "text-violet-700 dark:text-violet-300"}`}>
            {isUser ? "User" : "Assistant"}
          </span>
          <span className="text-[10px] text-gray-500 dark:text-gray-500">{formatLocalTime(item.timestamp)}</span>
        </div>

        <div className="space-y-2">{item.parts.map(renderPart)}</div>

        {item.usage ? (
          <div className="mt-2 border-t border-divider pt-2 text-[10px] font-mono text-foreground-500 dark:border-white/10 dark:text-gray-500">
            in {formatTokens(item.usage.input)} · cached {formatTokens(item.usage.cacheRead)} · out {formatTokens(item.usage.output)} · total {formatTokens(item.usage.totalTokens)}
            {stopReasonLabel ? ` · stop ${stopReasonLabel}` : ""}
            {item.usage.costUsd > 0 ? ` · ${formatCost(item.usage.costUsd)}` : ""}
          </div>
        ) : null}
      </div>
    );
  }, [formatCost, formatLocalTime, formatTokens, renderPart]);

  return (
    <div className="rounded border border-divider bg-white dark:bg-[#0A0A0A]">
      <div className="sticky top-0 z-20 border-b border-divider bg-white dark:bg-[#0A0A0A] px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-foreground-400 uppercase tracking-wider">Sessions</p>
          {pageInfo ? (
            <span className="text-[10px] font-mono text-foreground-400">{sessions.length} / {pageInfo.totalCount}</span>
          ) : null}
        </div>

        <div className="mt-3 hidden items-center gap-2 md:flex">
          <Select
            aria-label="Filter by agent"
            selectedKeys={new Set(agentFilter)}
            selectionMode="multiple"
            disallowEmptySelection={false}
            onSelectionChange={(keys) => {
              if (keys === "all") return;
              setAgentFilter(Array.from(keys).map(String));
            }}
            size="sm"
            variant="bordered"
            placeholder="Agent"
            className="max-w-[220px]"
            classNames={{ trigger: "h-8 min-h-8 border-divider bg-white dark:border-white/10 dark:bg-[#080808]" }}
          >
            {facets.agents.map((agent) => (
              <SelectItem key={agent.id} textValue={agent.label}>
                {agent.label} ({agent.count})
              </SelectItem>
            ))}
          </Select>

          <Select
            aria-label="Filter by model"
            selectedKeys={new Set(modelFilter)}
            selectionMode="multiple"
            disallowEmptySelection={false}
            onSelectionChange={(keys) => {
              if (keys === "all") return;
              setModelFilter(Array.from(keys).map(String));
            }}
            size="sm"
            variant="bordered"
            placeholder="Model"
            className="max-w-[280px]"
            classNames={{ trigger: "h-8 min-h-8 border-divider bg-white dark:border-white/10 dark:bg-[#080808]" }}
          >
            {facets.models.map((model) => (
              <SelectItem key={model.id} textValue={model.label}>
                {model.label} ({model.count})
              </SelectItem>
            ))}
          </Select>

          <Select
            aria-label="Date range"
            selectedKeys={new Set([datePreset])}
            onSelectionChange={(keys) => {
              if (keys === "all") return;
              const next = Array.from(keys)[0];
              if (typeof next === "string") {
                setDatePreset(next as DatePreset);
              }
            }}
            size="sm"
            variant="bordered"
            className="max-w-[170px]"
            classNames={{ trigger: "h-8 min-h-8 border-divider bg-white dark:border-white/10 dark:bg-[#080808]" }}
          >
            <SelectItem key="today">Today</SelectItem>
            <SelectItem key="last7">Last 7 days</SelectItem>
            <SelectItem key="last30">Last 30 days</SelectItem>
            <SelectItem key="custom">Custom range</SelectItem>
            <SelectItem key="all">All time</SelectItem>
          </Select>

          {datePreset === "custom" ? (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="h-8 rounded border border-divider bg-white px-2 text-xs text-foreground dark:border-white/10 dark:bg-[#080808] dark:text-gray-200"
              />
              <span className="text-xs text-gray-500">to</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="h-8 rounded border border-divider bg-white px-2 text-xs text-foreground dark:border-white/10 dark:bg-[#080808] dark:text-gray-200"
              />
            </div>
          ) : null}

          {hasActiveFilters ? (
            <button
              onClick={resetFilters}
              className="ml-auto text-xs text-gray-500 transition hover:text-foreground dark:hover:text-gray-200"
            >
              Clear filters
            </button>
          ) : null}
        </div>

        <div className="mt-3 md:hidden">
          <button
            onClick={() => setMobileFiltersOpen(true)}
            className="inline-flex items-center gap-1 rounded border border-divider bg-white px-2.5 py-1.5 text-xs text-foreground-500 dark:border-white/10 dark:bg-[#080808] dark:text-gray-300"
          >
            <Filter size={12} /> Filters
            {hasActiveFilters ? <span className="ml-1 rounded bg-white/10 px-1 text-[10px]">active</span> : null}
          </button>
        </div>
      </div>

      {error ? (
        <div className="px-4 py-6 text-sm text-danger-500">{error}</div>
      ) : loading ? (
        <div className="space-y-2 px-4 py-4">
          {[0, 1, 2, 3, 4].map((n) => (
            <div key={n} className="h-10 animate-pulse rounded bg-gray-100 dark:bg-white/5" />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <div className="px-4 py-8 text-center text-xs text-foreground-400">No sessions found for these filters.</div>
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-divider text-left text-[10px] uppercase tracking-wider text-gray-500 dark:border-white/10">
                  <th className="px-4 py-2 font-medium">Agent</th>
                  <th className="px-4 py-2 font-medium">Model</th>
                  <th className="px-4 py-2 font-medium">Task Context</th>
                  <th className="px-4 py-2 font-medium">Last activity</th>
                  <th className="px-4 py-2 font-medium text-right">Usage</th>
                  <th className="px-4 py-2 font-medium text-right">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider dark:divide-white/5">
                {sessions.map((row) => {
                  const canOpen = row.detail_available;
                  return (
                    <tr
                      key={row.session_ref}
                      onClick={() => {
                        if (canOpen) void openSessionDetail(row);
                      }}
                      className={`transition ${canOpen ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5" : "cursor-default opacity-60"}`}
                    >
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: agentColors[row.agent] || "#888" }} />
                          <span className="capitalize text-foreground-500 dark:text-[#D4D4D8]">{row.agent}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2 font-mono text-xs text-foreground-400">{row.model_label || row.model || "Unknown"}</td>
                      <td className="px-4 py-2 text-xs">
                        {row.task_id ? (
                          <div className="flex flex-col">
                            <span className="font-mono text-indigo-300">Task {row.task_id.slice(0, 8)}</span>
                            {row.task_title ? <span className="truncate text-gray-400" title={row.task_title}>{row.task_title}</span> : null}
                          </div>
                        ) : (
                          <span className="truncate font-mono text-gray-400" title={row.display_name || row.session_key || row.session_id || "-"}>
                            {row.display_name || row.session_key || row.session_id || "-"}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-xs text-foreground-500 dark:text-gray-300" title={row.last_activity_at || ""}>
                        {formatRelative(row.last_activity_at)}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-xs text-foreground-500 dark:text-gray-300">
                        {formatTokens(row.usage_total_tokens || 0)}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-xs text-foreground-500 dark:text-gray-300">
                        {row.cost_source === "none" ? "—" : row.cost_source === "unpriced" ? "unpriced" : formatCost(row.cost_usd || 0)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-2 p-3 md:hidden">
            {sessions.map((row) => {
              const canOpen = row.detail_available;
              return (
                <button
                  key={row.session_ref}
                  onClick={() => {
                    if (canOpen) void openSessionDetail(row);
                  }}
                  className={`w-full rounded border border-divider bg-white p-3 text-left dark:border-white/10 dark:bg-[#080808] ${canOpen ? "" : "opacity-60"}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: agentColors[row.agent] || "#888" }} />
                      <span className="text-xs font-medium capitalize text-foreground dark:text-gray-200">{row.agent}</span>
                    </div>
                    <span className="text-[10px] text-gray-500">{formatRelative(row.last_activity_at)}</span>
                  </div>
                  <div className="mt-2 text-[11px] text-foreground-400 dark:text-gray-400">{row.model_label || row.model || "Unknown"}</div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-gray-400">
                    <div>
                      <span className="block text-gray-500">Usage</span>
                      <span className="font-mono text-foreground dark:text-gray-200">{formatTokens(row.usage_total_tokens || 0)}</span>
                    </div>
                    <div>
                      <span className="block text-gray-500">Cost</span>
                      <span className="font-mono text-foreground dark:text-gray-200">{row.cost_source === "none" ? "—" : row.cost_source === "unpriced" ? "unpriced" : formatCost(row.cost_usd || 0)}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="border-t border-divider px-4 py-3 dark:border-white/10">
            {pageInfo?.hasMore ? (
              <button
                onClick={() => void loadSessions({ cursor: pageInfo.nextCursor })}
                disabled={loadingMore}
                className="w-full rounded border border-divider bg-white px-3 py-2 text-xs text-foreground transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-[#080808] dark:text-gray-200 dark:hover:bg-white/5"
              >
                {loadingMore ? "Loading…" : `Load more sessions (${sessions.length} of ${pageInfo.totalCount})`}
              </button>
            ) : (
              <div className="text-center text-[11px] text-gray-500">Showing {sessions.length} of {pageInfo?.totalCount || sessions.length} sessions</div>
            )}
          </div>
        </>
      )}

      <Modal
        isOpen={mobileFiltersOpen}
        onOpenChange={(open) => setMobileFiltersOpen(open)}
        placement="bottom"
        classNames={{
          base: "bg-white border border-divider dark:bg-[#080808] dark:border-white/10",
          closeButton: "text-foreground-400 hover:text-foreground dark:text-gray-400 dark:hover:text-white",
        }}
      >
        <ModalContent>
          <ModalHeader className="border-b border-divider text-sm dark:border-white/10">Filters</ModalHeader>
          <ModalBody className="space-y-3 py-4">
            <Select
              aria-label="Filter agents"
              selectedKeys={new Set(agentFilter)}
              selectionMode="multiple"
              disallowEmptySelection={false}
              onSelectionChange={(keys) => {
                if (keys === "all") return;
                setAgentFilter(Array.from(keys).map(String));
              }}
              size="sm"
              variant="bordered"
            >
              {facets.agents.map((agent) => (
                <SelectItem key={agent.id}>{agent.label} ({agent.count})</SelectItem>
              ))}
            </Select>

            <Select
              aria-label="Filter models"
              selectedKeys={new Set(modelFilter)}
              selectionMode="multiple"
              disallowEmptySelection={false}
              onSelectionChange={(keys) => {
                if (keys === "all") return;
                setModelFilter(Array.from(keys).map(String));
              }}
              size="sm"
              variant="bordered"
            >
              {facets.models.map((model) => (
                <SelectItem key={model.id}>{model.label} ({model.count})</SelectItem>
              ))}
            </Select>

            <Select
              aria-label="Date range"
              selectedKeys={new Set([datePreset])}
              onSelectionChange={(keys) => {
                if (keys === "all") return;
                const next = Array.from(keys)[0];
                if (typeof next === "string") setDatePreset(next as DatePreset);
              }}
              size="sm"
              variant="bordered"
            >
              <SelectItem key="today">Today</SelectItem>
              <SelectItem key="last7">Last 7 days</SelectItem>
              <SelectItem key="last30">Last 30 days</SelectItem>
              <SelectItem key="custom">Custom range</SelectItem>
              <SelectItem key="all">All time</SelectItem>
            </Select>

            {datePreset === "custom" ? (
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="h-9 rounded border border-divider bg-white px-2 text-xs text-foreground dark:border-white/10 dark:bg-[#080808] dark:text-gray-200"
                />
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="h-9 rounded border border-divider bg-white px-2 text-xs text-foreground dark:border-white/10 dark:bg-[#080808] dark:text-gray-200"
                />
              </div>
            ) : null}

            <div className="flex items-center justify-between pt-2">
              <button onClick={resetFilters} className="text-xs text-foreground-400 dark:text-gray-400">Clear</button>
              <button
                onClick={() => setMobileFiltersOpen(false)}
                className="rounded border border-divider px-3 py-1.5 text-xs text-foreground dark:border-white/10 dark:text-gray-100"
              >
                Apply
              </button>
            </div>
          </ModalBody>
        </ModalContent>
      </Modal>

      <Modal
        isOpen={!!selectedSession}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedSession(null);
            setDetail(null);
            setDetailError(null);
          }
        }}
        size="5xl"
        scrollBehavior="inside"
        backdrop="blur"
        classNames={{
          base: "h-screen max-h-screen w-full max-w-full rounded-none border-0 bg-white dark:bg-[#080808] md:h-[85vh] md:max-h-[85vh] md:max-w-5xl md:rounded-md md:border md:border-divider md:dark:border-white/10",
          closeButton: "text-foreground-400 hover:text-foreground dark:text-gray-400 dark:hover:text-white",
          body: "p-0",
          header: "sticky top-0 z-10 border-b border-divider bg-white dark:border-white/10 dark:bg-[#080808]",
        }}
      >
        <ModalContent>
          <ModalHeader className="flex items-center justify-between gap-3 py-3">
            <div>
              <div className="text-sm font-medium text-foreground dark:text-gray-100">
                {selectedSession?.agent ? `${selectedSession.agent} session` : "Session detail"}
              </div>
              <div className="text-xs text-foreground-400 dark:text-gray-400">
                {selectedSession?.task_title || selectedSession?.display_name || selectedSession?.session_key || selectedSession?.session_id || ""}
              </div>
            </div>
            <div className="grid gap-0.5 text-right text-[11px] font-mono text-foreground-500 dark:text-gray-400">
              <div>Total {selectedSession ? formatTokens(selectedSession.usage_total_tokens || 0) : "0"}</div>
              <div>In {selectedSession ? formatTokens(selectedSession.input_tokens || 0) : "0"}</div>
              <div>Cached {selectedSession ? formatTokens(selectedSession.cached_input_tokens || 0) : "0"}</div>
              <div>Out {selectedSession ? formatTokens(selectedSession.output_tokens || 0) : "0"}</div>
              <div>
                Cost {selectedSession
                  ? (selectedSession.cost_source === "none"
                    ? "—"
                    : selectedSession.cost_source === "unpriced"
                      ? "unpriced"
                      : formatCost(selectedSession.cost_usd || 0))
                  : "$0.00"}
              </div>
            </div>
          </ModalHeader>

          <ModalBody className="overflow-y-auto p-4 md:p-6">
            {detailLoading ? (
              <div className="flex items-center justify-center py-10 text-xs text-foreground-400 dark:text-gray-400">Loading session thread…</div>
            ) : detailError ? (
              <div className="rounded border border-danger-500/30 bg-danger-500/10 px-3 py-2 text-xs text-danger-400">{detailError}</div>
            ) : detail ? (
              <div className="space-y-3">
                {detail.thread.pageInfo.hasMoreOlder ? (
                  <button
                    onClick={() => void loadOlderThreadItems()}
                    disabled={detailLoadingOlder}
                    className="w-full rounded border border-divider bg-white px-3 py-2 text-xs text-foreground-500 hover:bg-gray-50 disabled:opacity-60 dark:border-white/10 dark:bg-[#060606] dark:text-gray-300 dark:hover:bg-white/5"
                  >
                    {detailLoadingOlder ? "Loading older messages…" : "Load older messages"}
                  </button>
                ) : null}

                {detail.thread.items.length === 0 ? (
                  <div className="py-8 text-center text-xs text-gray-500">No transcript events available.</div>
                ) : (
                  detail.thread.items.map((item) => renderThreadItem(item))
                )}
              </div>
            ) : null}
          </ModalBody>
        </ModalContent>
      </Modal>
    </div>
  );
}
