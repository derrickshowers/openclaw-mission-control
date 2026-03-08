"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Chip, Button } from "@heroui/react";

interface ActivityEntry {
  id: number;
  seq: number;
  event_type: string;
  agent: string | null;
  payload: Record<string, any>;
  created_at: string;
}

const eventTypeColors: Record<string, "default" | "primary" | "success" | "warning" | "danger"> = {
  "task.created": "primary",
  "task.updated": "default",
  "task.deleted": "danger",
  "task.moved": "warning",
  "agent.session.start": "success",
  "agent.session.end": "default",
  "agent.tool.call": "default",
  "agent.error": "danger",
};

const AGENTS = ["frank", "tom", "michael", "joanna"];

export function ActivityFeed() {
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [agentFilter, setAgentFilter] = useState<string | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [connected, setConnected] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Load initial activity
  useEffect(() => {
    const loadActivity = async () => {
      try {
        const params = agentFilter ? `?agent=${agentFilter}&limit=50` : "?limit=50";
        const res = await fetch(`/api/proxy/activity${params}`);
        const data = await res.json();
        setActivities(Array.isArray(data) ? data.reverse() : []);
      } catch {
        setActivities([]);
      }
    };
    loadActivity();
  }, [agentFilter]);

  // SSE connection for real-time updates
  useEffect(() => {
    const es = new EventSource(`/api/proxy/activity/stream`);
    eventSourceRef.current = es;

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const entry: ActivityEntry = {
          id: parseInt(event.lastEventId || "0"),
          seq: parseInt(event.lastEventId || "0"),
          event_type: data.type || "event",
          agent: data.agent || null,
          payload: data,
          created_at: data.ts || new Date().toISOString(),
        };
        setActivities((prev) => [...prev.slice(-199), entry]);
      } catch {}
    };

    return () => es.close();
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [activities, autoScroll]);

  const handleScroll = useCallback(() => {
    if (!feedRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = feedRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 50);
  }, []);

  const filteredActivities = agentFilter
    ? activities.filter((a) => a.agent === agentFilter)
    : activities;

  return (
    <div className="mx-auto flex h-full max-w-[1200px] flex-col">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`h-2 w-2 rounded-full ${connected ? "bg-green-500" : "bg-[#555555]"}`} />
          <span className="text-xs text-[#888888]">
            {connected ? "Live" : "Offline"} · {filteredActivities.length} events
          </span>
        </div>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant={agentFilter === null ? "flat" : "light"}
            className={`text-xs h-6 min-w-0 px-2 ${agentFilter === null ? "bg-[#1A1A1A]" : ""}`}
            onPress={() => setAgentFilter(null)}
          >
            All
          </Button>
          {AGENTS.map((agent) => (
            <Button
              key={agent}
              size="sm"
              variant={agentFilter === agent ? "flat" : "light"}
              className={`text-xs h-6 min-w-0 px-2 capitalize ${agentFilter === agent ? "bg-[#1A1A1A]" : ""}`}
              onPress={() => setAgentFilter(agentFilter === agent ? null : agent)}
            >
              {agent}
            </Button>
          ))}
        </div>
      </div>

      {/* Feed */}
      <div
        ref={feedRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto rounded border border-[#222222] bg-[#0A0A0A] font-mono text-xs"
      >
        {filteredActivities.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-[#555555]">No activity yet</p>
          </div>
        ) : (
          <div className="divide-y divide-[#1A1A1A]">
            {filteredActivities.map((entry, i) => (
              <div
                key={entry.id || i}
                className="flex items-start gap-3 px-3 py-2 hover:bg-[#121212]"
              >
                <span className="flex-shrink-0 text-[#555555] w-[140px]">
                  {new Date(entry.created_at).toLocaleTimeString()}
                </span>
                <Chip
                  size="sm"
                  variant="flat"
                  color={eventTypeColors[entry.event_type] || "default"}
                  className="flex-shrink-0 text-[10px] h-5"
                >
                  {entry.event_type}
                </Chip>
                {entry.agent && (
                  <span className="flex-shrink-0 text-[#888888] capitalize w-16">
                    {entry.agent}
                  </span>
                )}
                <span className="flex-1 truncate text-[#CCCCCC]">
                  {formatPayload(entry.payload)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Auto-scroll indicator */}
      {!autoScroll && (
        <button
          onClick={() => {
            setAutoScroll(true);
            if (feedRef.current) {
              feedRef.current.scrollTop = feedRef.current.scrollHeight;
            }
          }}
          className="mt-2 self-center rounded border border-[#222222] bg-[#121212] px-3 py-1 text-xs text-[#888888] hover:text-white"
        >
          ↓ Scroll to latest
        </button>
      )}
    </div>
  );
}

function formatPayload(payload: Record<string, any>): string {
  if (payload.task?.title) return payload.task.title;
  if (payload.message) return payload.message;
  if (payload.summary) return payload.summary;
  if (payload.tool) return `${payload.tool}(${payload.target || ""})`;
  return JSON.stringify(payload).slice(0, 100);
}
