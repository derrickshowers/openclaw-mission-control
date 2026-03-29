"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Input, Button } from "@heroui/react";
import { Search, RefreshCw, ArrowDown } from "lucide-react";
import { parseUTC } from "@/lib/dates";

interface LogEntry {
  time: string;
  level: string;
  source: string;
  message: string;
}

type LogSource = "gateway_active" | "historical_date" | "fallback_local_latest";

const LEVELS = ["debug", "info", "warn", "error"] as const;
type Level = (typeof LEVELS)[number];

const LEVEL_COLORS: Record<string, string> = {
  debug: "text-foreground-400",
  info: "text-blue-500 dark:text-[#8BE9FD]",
  warn: "text-warning-500 dark:text-[#FFB86C]",
  error: "text-danger-500 dark:text-[#FF5555]",
  fatal: "text-danger-600 dark:text-[#FF5555]",
};

const LEVEL_BG: Record<string, string> = {
  debug: "bg-gray-100 dark:bg-[#888888]/10",
  info: "bg-blue-500/10 dark:bg-[#8BE9FD]/10",
  warn: "bg-warning-500/10 dark:bg-[#FFB86C]/10",
  error: "bg-danger-500/10 dark:bg-[#FF5555]/10",
  fatal: "bg-danger-600/10 dark:bg-[#FF5555]/10",
};

function formatLogTime(isoStr: string): string {
  const d = parseUTC(isoStr);
  if (isNaN(d.getTime())) return isoStr;
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatLogFileName(date: string | null, fileName: string | null): string {
  if (fileName) return fileName;
  return date ? `openclaw-${date}.log` : "Resolving active log file…";
}

function getSourcePresentation(source: LogSource | null, selectedDate: string) {
  if (source === "historical_date" || selectedDate) {
    return {
      label: "Viewing selected historical log file",
      badge: "Historical file override",
      description: "You selected a specific UTC-dated log file. Entry times below are shown in your local timezone.",
    };
  }

  if (source === "fallback_local_latest") {
    return {
      label: "Fallback to local log file",
      badge: "Gateway active source unavailable",
      description:
        "Mission Control could not resolve the gateway's active log source, so this view fell back to a local file. Entry times below are shown in your local timezone.",
    };
  }

  return {
    label: "Following gateway active log file",
    badge: "Matches OpenClaw dashboard source",
    description:
      "Default mode follows the same gateway log source as the OpenClaw dashboard. File names use UTC dates, while entry times below are shown in your local timezone.",
  };
}

export function LogsViewer() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [minLevel, setMinLevel] = useState<Level>("debug");
  const [selectedDate, setSelectedDate] = useState("");
  const [resolvedLogDate, setResolvedLogDate] = useState<string | null>(null);
  const [resolvedLogFile, setResolvedLogFile] = useState<string | null>(null);
  const [resolvedLogSource, setResolvedLogSource] = useState<LogSource | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const timezoneLabel = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "your local timezone",
    []
  );

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchLogs = useCallback(async () => {
    try {
      const params = new URLSearchParams({ level: minLevel, limit: "500" });
      if (selectedDate) params.set("date", selectedDate);
      if (debouncedSearch) params.set("search", debouncedSearch);

      const res = await fetch(`/api/mc/logs?${params.toString()}`);
      if (!res.ok) return;

      setResolvedLogDate(res.headers.get("x-log-date"));
      setResolvedLogFile(res.headers.get("x-log-file"));
      setResolvedLogSource((res.headers.get("x-log-source") as LogSource | null) ?? null);
      const data: LogEntry[] = await res.json();
      setLogs(data);
    } catch (err) {
      console.error("Failed to fetch logs:", err);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, minLevel, selectedDate]);

  // Initial fetch + polling
  useEffect(() => {
    setLoading(true);
    fetchLogs();
    pollTimer.current = setInterval(fetchLogs, 5000);
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, [fetchLogs]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // Track scroll position for auto-scroll pause
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const atBottom = scrollHeight - scrollTop - clientHeight < 40;
    setAutoScroll(atBottom);
  }, []);

  const scrollToBottom = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
      setAutoScroll(true);
    }
  }, []);

  const activeLogDate = resolvedLogDate ?? (selectedDate || null);
  const logFileName = formatLogFileName(activeLogDate, resolvedLogFile);
  const sourcePresentation = getSourcePresentation(resolvedLogSource, selectedDate);

  return (
    <div className="flex h-full flex-col gap-0">
      {/* Sticky filter + context bar */}
      <div className="sticky top-0 z-10 border-b border-divider bg-white dark:bg-[#080808]">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
          {/* Search */}
          <div className="min-w-[220px] flex-1 max-w-[400px]">
            <Input
              placeholder="Search logs..."
              value={search}
              onValueChange={setSearch}
              size="sm"
              variant="bordered"
              startContent={<Search size={14} className="text-foreground-300" />}
              classNames={{
                inputWrapper: "border-divider bg-gray-50 dark:bg-[#0A0A0A] h-8 min-h-8",
                input: "text-xs",
              }}
            />
          </div>

          <div className="flex items-center gap-2">
            <Input
              type="date"
              aria-label="Log date"
              value={selectedDate}
              onValueChange={setSelectedDate}
              size="sm"
              variant="bordered"
              className="w-[180px]"
              classNames={{
                inputWrapper: "border-divider bg-gray-50 dark:bg-[#0A0A0A] h-8 min-h-8",
                input: "text-xs",
              }}
            />
            {selectedDate ? (
              <Button
                size="sm"
                variant="flat"
                onPress={() => setSelectedDate("")}
                className="h-8 min-w-0 border border-divider bg-gray-50 px-2 text-[11px] text-foreground-500 dark:border-white/10 dark:bg-[#0A0A0A]"
              >
                Follow active
              </Button>
            ) : null}
          </div>

          {/* Level toggles */}
          <div className="flex items-center gap-1">
            {LEVELS.map((level) => (
              <button
                key={level}
                onClick={() => setMinLevel(level)}
                className={`rounded px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider transition-colors ${
                  minLevel === level
                    ? `${LEVEL_COLORS[level]} ${LEVEL_BG[level]} ring-1 ring-current/20`
                    : "text-foreground-400 hover:text-foreground-500"
                }`}
              >
                {level}
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="ml-auto flex items-center gap-1">
            <Button
              isIconOnly
              size="sm"
              variant="light"
              onPress={fetchLogs}
              className="h-7 w-7 min-w-0 text-foreground-400 hover:text-foreground"
            >
              <RefreshCw size={13} />
            </Button>
            {!autoScroll && (
              <Button
                isIconOnly
                size="sm"
                variant="light"
                onPress={scrollToBottom}
                className="h-7 w-7 min-w-0 text-foreground-400 hover:text-foreground"
              >
                <ArrowDown size={13} />
              </Button>
            )}
          </div>
        </div>

        <div className="border-t border-divider/70 px-4 py-2 text-[11px] text-foreground-500 dark:border-[#111111]">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-medium text-foreground-600 dark:text-foreground-400">{sourcePresentation.label}</span>
            <span className="rounded bg-default-100 px-2 py-0.5 text-[11px] text-foreground-700 dark:bg-white/5 dark:text-zinc-200">
              {sourcePresentation.badge}
            </span>
            <span className="rounded bg-default-100 px-2 py-0.5 font-mono text-[11px] text-foreground-700 dark:bg-white/5 dark:text-zinc-200">
              {logFileName}
            </span>
            {activeLogDate ? (
              <span className="font-mono text-foreground-400">UTC file date {activeLogDate}</span>
            ) : null}
          </div>
          <p className="mt-1 text-foreground-400">
            {sourcePresentation.description} Current timezone: {timezoneLabel}.
          </p>
        </div>
      </div>

      {/* Log container */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto bg-white font-mono text-xs dark:bg-[#080808]"
        style={{ fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" }}
      >
        {loading && logs.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-foreground-300">Loading logs...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex h-full items-center justify-center px-6 text-center">
            <div>
              <p className="text-foreground-300">No logs matching filters</p>
              <p className="mt-1 text-[11px] text-foreground-400">
                Current file: <span className="font-mono">{logFileName}</span>
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-divider dark:divide-[#111111]">
            {logs.map((entry, i) => (
              <div
                key={`${entry.time}-${i}`}
                className="flex items-start gap-3 px-4 py-1.5 transition-colors hover:bg-gray-50 dark:hover:bg-[#1A1A1A]"
              >
                {/* Timestamp */}
                <span className="w-[72px] flex-shrink-0 select-all text-foreground-300">
                  {formatLogTime(entry.time)}
                </span>

                {/* Level badge */}
                <span
                  className={`flex-shrink-0 w-[44px] text-center font-semibold uppercase ${LEVEL_COLORS[entry.level] || "text-foreground-400"}`}
                >
                  {entry.level === "error"
                    ? "ERR"
                    : entry.level === "warning"
                      ? "WARN"
                      : entry.level.slice(0, 4).toUpperCase()}
                </span>

                {/* Source */}
                {entry.source && (
                  <span className="max-w-[160px] flex-shrink-0 truncate text-primary-500 dark:text-[#6366f1]">
                    [{entry.source}]
                  </span>
                )}

                {/* Message */}
                <span className="min-w-0 break-words whitespace-pre-wrap text-foreground-600 dark:text-[#D4D4D8]">
                  {entry.message}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
