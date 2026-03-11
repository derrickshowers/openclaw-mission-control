"use client";

import { useState, useEffect, useMemo } from "react";
import { parseUTC } from "@/lib/dates";
import { Card, CardBody, Chip } from "@heroui/react";
import { Crown, Crosshair, Landmark, Zap, Palette, Bot, Check, Loader2, Minus } from "lucide-react";
import { useSSE } from "@/hooks/use-sse";
import type { LucideIcon } from "lucide-react";

const agentMeta: Record<string, { role: string; description: string; Icon: LucideIcon }> = {
  derrick: {
    role: "Founder",
    description: "The human behind the team. Founder and orchestrator of OpenClaw.",
    Icon: Crown,
  },
  frank: {
    role: "Orchestrator",
    description: "Routes tasks, manages the team, delivers results to Derrick. The glue.",
    Icon: Crosshair,
  },
  tom: {
    role: "Lead Architect",
    description: "System design, technical specs, infrastructure decisions, code review.",
    Icon: Landmark,
  },
  michael: {
    role: "Full Stack Engineer",
    description: "Builds things. React, Next.js, TypeScript, APIs, the full stack.",
    Icon: Zap,
  },
  joanna: {
    role: "UX/Product Designer",
    description: "User experience, design direction, interaction patterns, accessibility.",
    Icon: Palette,
  },
  elena: {
    role: "OpenClaw Platform Specialist",
    description: "Platform operations, deployment workflows, and OpenClaw infrastructure.",
    Icon: Bot,
  },
};

function resolveAvatarUrl(url?: string, agentName?: string): string | undefined {
  if (agentName === "derrick") return "/images/team/derrick.jpg";
  if (!url) return undefined;
  if (url.startsWith('/api/agents/')) return url.replace('/api/agents/', '/api/mc/agents/');
  return url;
}

function formatLastActiveRelative(dateValue: string | number | Date | null | undefined): string {
  const d = parseUTC(dateValue);
  if (Number.isNaN(d.getTime())) return "—";

  const diffMs = Date.now() - d.getTime();
  if (diffMs < 60_000) return "just now";

  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;

  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;

  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface MainSessionRow {
  agent: string;
  sessionKey: string;
  model: string;
  totalTokens: number;
  maxContext: number;
  contextTokens?: number;
  contextWindow?: number;
  fullness: number;
  recentMedianOutputTokens?: number;
  estimatedNextTaskCostUsd: number;
  source: string;
  lastActiveAt?: string | number | Date | null;
}

interface TeamViewProps {
  agents: any[];
}

export function TeamView({ agents }: TeamViewProps) {
  const [liveStatuses, setLiveStatuses] = useState<Map<string, any>>(new Map());
  const [mainSessions, setMainSessions] = useState<MainSessionRow[]>([]);
  const [sessionLoading, setSessionLoading] = useState<Record<string, boolean | "success" | "skipped">>({});
  const [, setNowTick] = useState(Date.now());

  const { lastEvent } = useSSE("agent.status");

  useEffect(() => {
    if (!lastEvent?.data?.agent) return;
    setLiveStatuses((prev) => {
      const next = new Map(prev);
      next.set(lastEvent.data.agent, lastEvent.data);
      return next;
    });
  }, [lastEvent]);

  const loadMainSessions = async () => {
    try {
      const res = await fetch("/api/mc/agents/live-sessions");
      const data = await res.json();
      const rows = (Array.isArray(data) ? data : [])
        .filter((r: any) => /^agent:[^:]+:main$/.test(String(r.sessionKey || "")))
        .sort((a: any, b: any) => a.agent.localeCompare(b.agent));
      setMainSessions(rows);
    } catch {
      setMainSessions([]);
    }
  };

  useEffect(() => {
    loadMainSessions();
    const id = setInterval(loadMainSessions, 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const runSessionAction = async (sessionKey: string, action: "compact" | "reset") => {
    if (action === "reset" && !confirm("Reset this main session? This clears current context.")) return;

    const loadingKey = `${action}:${sessionKey}`;
    setSessionLoading((prev) => ({ ...prev, [loadingKey]: true }));

    try {
      const res = await fetch(`/api/mc/agents/sessions/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionKey }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Failed");

      const nextState = action === "compact" && data?.result?.compacted === false ? "skipped" : "success";
      setSessionLoading((prev) => ({ ...prev, [loadingKey]: nextState }));
      await loadMainSessions();
      setTimeout(() => {
        setSessionLoading((prev) => {
          const next = { ...prev };
          delete next[loadingKey];
          return next;
        });
      }, 1500);
    } catch {
      setSessionLoading((prev) => {
        const next = { ...prev };
        delete next[loadingKey];
        return next;
      });
      // In a real app we'd trigger a toast here
    }
  };

  const knownNames = Object.keys(agentMeta);
  const mapByName = new Map((agents || []).map((a: any) => [a.name, a]));
  const baseList = knownNames.map((name) => mapByName.get(name) || { name });

  const mainSessionByAgent = useMemo(() => {
    const map = new Map<string, MainSessionRow>();
    for (const s of mainSessions) {
      map.set(s.agent, s);
    }
    return map;
  }, [mainSessions]);

  // Merge live status into agent data
  const agentList = baseList.map((agent: any) => {
    const live = liveStatuses.get(agent.name);
    const mainSession = mainSessionByAgent.get(agent.name);

    return {
      ...agent,
      status: live?.status || agent.status,
      model: live?.model || agent.model,
      lastActiveAt: mainSession?.lastActiveAt ?? null,
    };
  });

  return (
    <div className="mx-auto max-w-[1200px]">
      {/* Hierarchy: Derrick at top, team below */}
      <div className="mb-6">
        <p className="mb-4 text-xs text-[#888888] uppercase tracking-wider">
          Founder
        </p>
        <AgentCard
          agent={agentList.find((a: any) => a.name === "derrick") || { name: "derrick" }}
          meta={agentMeta.derrick}
        />
      </div>

      <div className="mb-2 flex items-center gap-3">
        <div className="h-px flex-1 bg-[#222222]" />
        <span className="text-xs text-[#555555]">reports to</span>
        <div className="h-px flex-1 bg-[#222222]" />
      </div>

      <div className="mb-4">
        <p className="mb-4 text-xs text-[#888888] uppercase tracking-wider">
          Team
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          {agentList
            .filter((a: any) => a.name !== "derrick")
            .map((agent: any) => (
              <AgentCard
                key={agent.name}
                agent={agent}
                meta={agentMeta[agent.name]}
              />
            ))}
        </div>
      </div>

      <div className="mb-6 rounded border border-[#222222] bg-[#0A0A0A]">
        <div className="border-b border-[#222222] px-4 py-2.5">
          <p className="text-xs uppercase tracking-wider text-[#888888]">Main Session Health</p>
          <p className="mt-1 text-[11px] text-[#666666]">
            Forward-looking cost estimates based on current session occupancy and recent median output. For historical spend, see the Activity tab.
          </p>
        </div>
        {mainSessions.length === 0 ? (
          <p className="px-4 py-5 text-xs text-[#666666]">No active main sessions.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#1A1A1A] text-[#777777] uppercase tracking-wider">
                  <th className="px-4 py-2 text-left">Agent</th>
                  <th className="px-4 py-2 text-left">Model</th>
                  <th
                    className="px-4 py-2 text-left"
                    title="Current session context occupancy relative to the model context window."
                  >
                    Session Fullness
                  </th>
                  <th className="px-4 py-2 text-left">Last Active</th>
                  <th className="px-4 py-2 text-right">Est. Next Turn Cost</th>
                  <th className="px-4 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#161616]">
                {mainSessions.map((s) => {
                  const contextTokens = Math.max(0, Number(s.contextTokens ?? s.totalTokens ?? 0));
                  const contextWindow = Math.max(1, Number(s.contextWindow ?? s.maxContext ?? 1));
                  const pct = Math.min((contextTokens / contextWindow) * 100, 100);
                  const bar = pct > 80 ? "#ef4444" : pct > 55 ? "#f59e0b" : "#22c55e";
                  return (
                    <tr key={s.sessionKey}>
                      <td className="px-4 py-2 capitalize text-white">{s.agent}</td>
                      <td className="px-4 py-2 font-mono text-[#BBBBBB]">{s.model}</td>
                      <td className="px-4 py-2" title={`${contextTokens.toLocaleString()} / ${contextWindow.toLocaleString()} tokens`}>
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-32 overflow-hidden rounded-full bg-[#222222]">
                            <div className="h-full" style={{ width: `${pct}%`, backgroundColor: bar }} />
                          </div>
                          <span className="font-mono text-[#BBBBBB]">{Math.round(pct)}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-[#999999]">{formatLastActiveRelative(s.lastActiveAt)}</td>
                      <td className="px-4 py-2 text-right font-mono text-white">${(s.estimatedNextTaskCostUsd || 0).toFixed(4)}</td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <SessionActionButton
                            action="compact"
                            loadingState={sessionLoading[`compact:${s.sessionKey}`]}
                            onClick={() => runSessionAction(s.sessionKey, "compact")}
                          />
                          <SessionActionButton
                            action="reset"
                            loadingState={sessionLoading[`reset:${s.sessionKey}`]}
                            onClick={() => runSessionAction(s.sessionKey, "reset")}
                          />
                        </div>
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

function SessionActionButton({ 
  action, 
  loadingState, 
  onClick 
}: { 
  action: "compact" | "reset";
  loadingState: boolean | "success" | "skipped" | undefined;
  onClick: () => void;
}) {
  const isLoading = loadingState === true;
  const isSuccess = loadingState === "success";
  const isSkipped = loadingState === "skipped";

  const baseStyles = "flex items-center justify-center gap-1.5 rounded px-2.5 py-1.5 text-[11px] font-medium transition-all duration-200 min-w-[80px]";
  const variantStyles = action === "compact"
    ? "border border-[#333333] bg-[#111111] hover:bg-[#1a1a1a] text-white"
    : "border border-[#4b1f1f] bg-[#1b0f0f] hover:bg-[#2a1515] text-[#fca5a5]";

  const disabledStyles = "opacity-50 cursor-not-allowed pointer-events-none";

  return (
    <button
      onClick={onClick}
      disabled={!!loadingState}
      className={`${baseStyles} ${variantStyles} ${loadingState ? disabledStyles : ""}`}
    >
      {isLoading ? (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>{action === "compact" ? "Compacting..." : "Resetting..."}</span>
        </>
      ) : isSuccess ? (
        <>
          <Check className="h-3 w-3" />
          <span>{action === "compact" ? "Compacted!" : "Reset!"}</span>
        </>
      ) : isSkipped ? (
        <>
          <Minus className="h-3 w-3" />
          <span>No change</span>
        </>
      ) : (
        <span>{action === "compact" ? "Compact" : "Reset"}</span>
      )}
    </button>
  );
}

const activityStateConfig: Record<string, { color: "success" | "warning" | "default" | "primary" | "secondary"; label: string; pulse?: boolean }> = {
  active: { color: "success", label: "Active", pulse: true },
  recently_active: { color: "primary", label: "Active" },
  idle: { color: "default", label: "Idle" },
  stale: { color: "default", label: "Stale" },
  uninitialized: { color: "default", label: "No session" },
};

const attentionConfig: Record<string, { color: "danger"; label: string }> = {
  aborted_last_run: { color: "danger", label: "Aborted last run" },
};

function formatModel(model?: string): string {
  if (!model) return "";
  // e.g. "anthropic/claude-opus-4-6" → "Claude Opus 4.6"
  const name = model.split("/").pop() || model;
  return name
    .replace(/^claude-/, "Claude ")
    .replace(/^gemini-/, "Gemini ")
    .replace(/-/g, " ")
    .replace(/(\d+) (\d+)/, "$1.$2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function AgentCard({
  agent,
  meta,
}: {
  agent: any;
  meta: { role: string; description: string; Icon: LucideIcon };
}) {
  const IconComponent = meta?.Icon || Bot;
  const activity = activityStateConfig[agent.activityState] || activityStateConfig.uninitialized;
  const attention = agent.attention !== "none" ? attentionConfig[agent.attention] : null;
  const avatarUrl = resolveAvatarUrl(agent.avatarUrl, agent.name);

  return (
    <Card className="border border-[#222222] bg-content1">
      <CardBody className="p-4">
        <div className="flex items-start gap-3">
          {avatarUrl ? (
            <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded">
              <img
                src={avatarUrl}
                alt={agent.name}
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded bg-[#1A1A1A] text-muted-foreground">
              <IconComponent size={20} strokeWidth={1.5} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium capitalize">{agent.name}</h3>
              <Chip
                size="sm"
                variant="flat"
                color={activity.color as any}
                className={`text-[10px] h-5 ${activity.pulse ? "animate-pulse" : ""}`}
              >
                {activity.label}
              </Chip>
              {attention && (
                <Chip
                  size="sm"
                  variant="flat"
                  color="danger"
                  className="text-[10px] h-5"
                >
                  {attention.label}
                </Chip>
              )}
            </div>
            <p className="text-xs text-[#888888] mt-0.5">
              {meta?.role || "Agent"}
            </p>
            {agent.model && (
              <p className="text-[11px] text-[#555555] mt-0.5 font-mono">
                {formatModel(agent.model)}
              </p>
            )}
            <p className="text-xs text-[#555555] mt-2 line-clamp-2">
              {meta?.description || ""}
            </p>
            <div className="mt-2 border-t border-[#1c1c1c] pt-2">
              <p className="text-[10px] uppercase tracking-wider text-[#777777]">
                {agent.activityState === "active" ? "Processing" : "Last active"}
              </p>
              <p className="text-xs text-[#BBBBBB] mt-0.5">
                {agent.activityState === "active" ? "Working now" : formatLastActiveRelative(agent.lastActiveAt)}
              </p>
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
