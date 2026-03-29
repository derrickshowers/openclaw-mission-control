"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Input, Button } from "@heroui/react";
import { Search, RefreshCw, ArrowDown } from "lucide-react";
import { parseUTC } from "@/lib/dates";

interface LogEntry {
  time: string;
  level: string;
  source: string;
  message: string;
}

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

export function LogsViewer() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [minLevel, setMinLevel] = useState<Level>("debug");
  const [autoScroll, setAutoScroll] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const wasAtBottom = useRef(true);
  const pollTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchLogs = useCallback(async () => {
    try {
      const params = new URLSearchParams({ level: minLevel, limit: "500" });
      if (debouncedSearch) params.set("search", debouncedSearch);
      const res = await fetch(`/api/mc/logs?${params}`);
      if (!res.ok) return;
      const data: LogEntry[] = await res.json();
      setLogs(data);
    } catch (err) {
      console.error("Failed to fetch logs:", err);
    } finally {
      setLoading(false);
    }
  }, [minLevel, debouncedSearch]);

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
    wasAtBottom.current = atBottom;
    setAutoScroll(atBottom);
  }, []);

  const scrollToBottom = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
      setAutoScroll(true);
    }
  }, []);

  return (
    <div className="flex h-full flex-col gap-0">
      {/* Sticky filter bar */}
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-divider bg-white dark:bg-[#080808] px-4 py-3">
        {/* Search */}
        <div className="flex-1 min-w-[200px] max-w-[400px]">
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
        <div className="flex items-center gap-1 ml-auto">
          <Button
            isIconOnly
            size="sm"
            variant="light"
            onPress={fetchLogs}
            className="text-foreground-400 hover:text-foreground h-7 w-7 min-w-0"
          >
            <RefreshCw size={13} />
          </Button>
          {!autoScroll && (
            <Button
              isIconOnly
              size="sm"
              variant="light"
              onPress={scrollToBottom}
              className="text-foreground-400 hover:text-foreground h-7 w-7 min-w-0"
            >
              <ArrowDown size={13} />
            </Button>
          )}
        </div>
      </div>

      {/* Log container */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto bg-white dark:bg-[#080808] font-mono text-xs"
        style={{ fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" }}
      >
        {loading && logs.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-foreground-300">Loading logs...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-foreground-300">No logs matching filters</p>
          </div>
        ) : (
          <div className="divide-y divide-divider dark:divide-[#111111]">
            {logs.map((entry, i) => (
              <div
                key={`${entry.time}-${i}`}
                className="flex items-start gap-3 px-4 py-1.5 hover:bg-gray-50 dark:hover:bg-[#1A1A1A] transition-colors"
              >
                {/* Timestamp */}
                <span className="flex-shrink-0 text-foreground-300 w-[72px] select-all">
                  {formatLogTime(entry.time)}
                </span>

                {/* Level badge */}
                <span
                  className={`flex-shrink-0 w-[44px] text-center uppercase font-semibold ${LEVEL_COLORS[entry.level] || "text-foreground-400"}`}
                >
                  {entry.level === "error" ? "ERR" : entry.level === "warning" ? "WARN" : entry.level.slice(0, 4).toUpperCase()}
                </span>

                {/* Source */}
                {entry.source && (
                  <span className="flex-shrink-0 text-primary-500 dark:text-[#6366f1] max-w-[160px] truncate">
                    [{entry.source}]
                  </span>
                )}

                {/* Message */}
                <span className="text-foreground-600 dark:text-[#D4D4D8] break-words min-w-0 whitespace-pre-wrap">
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
