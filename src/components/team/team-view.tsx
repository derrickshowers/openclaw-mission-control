"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { parseUTC } from "@/lib/dates";
import { normalizeAgentId, resolveAgentAvatarUrl } from "@/lib/agents";
import type { CronJob } from "@/lib/api";
import { StableImage } from "@/components/shared/stable-image";
import { CronCalendarSection } from "@/components/team/cron-calendar-section";
import { Button, Card, CardBody, Chip, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Tooltip } from "@heroui/react";
import { Crown, Crosshair, Landmark, Zap, Palette, Sprout, Bot, Check, Loader2, Minus, CircleHelp, XCircle } from "lucide-react";
import { useSSE } from "@/hooks/use-sse";
import type { LucideIcon } from "lucide-react";

const agentMeta: Record<string, { role: string; description: string; Icon: LucideIcon }> = {
  derrick: {
    role: "Founder",
    description: "The King of the Castle 👑",
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
  ivy: {
    role: "Venture Researcher",
    description: "Researches new business ideas, validates demand signals, and turns trend noise into grounded opportunities.",
    Icon: Sprout,
  },
  sloane: {
    role: "Creator Intelligence Lead",
    description: "Tracks creator communities, finds the real story underneath the public story, and turns creator noise into usable signal.",
    Icon: Bot,
  },
};

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
  initialCronJobs: CronJob[];
}

type CompactState =
  | "starting"
  | "queued"
  | "running"
  | "compacted"
  | "no_change"
  | "force_reduced"
  | "failed"
  | "cancelled";

function mapCompactState(status: string, outcome: string): CompactState {
  if (status === "queued") return "queued";
  if (status === "running") return "running";
  if (status === "cancelled") return "cancelled";
  if (status === "failed") return "failed";
  if (status === "completed") {
    if (outcome === "compacted") return "compacted";
    if (outcome === "force_reduced" || outcome === "trimmed") return "force_reduced";
    return "no_change";
  }
  if (status === "skipped") return "no_change";
  return "failed";
}

export function TeamView({ agents, initialCronJobs }: TeamViewProps) {
  const [liveStatuses, setLiveStatuses] = useState<Map<string, any>>(new Map());
  const [mainSessions, setMainSessions] = useState<MainSessionRow[]>([]);
  const [sessionLoading, setSessionLoading] = useState<Record<string, boolean | "success">>({});
  const [compactStates, setCompactStates] = useState<Record<string, CompactState | undefined>>({});
  const [sessionNotes, setSessionNotes] = useState<Record<string, string | undefined>>({});
  const [resetConfirmSessionKey, setResetConfirmSessionKey] = useState<string | null>(null);
  const compactPollers = useRef<Record<string, ReturnType<typeof setInterval>>>({});
  const [, setNowTick] = useState(Date.now());

  const { lastEvent } = useSSE("agent.status");

  useEffect(() => {
    const agent = normalizeAgentId(lastEvent?.data?.agent);
    if (!agent) return;
    setLiveStatuses((prev) => {
      const next = new Map(prev);
      next.set(agent, lastEvent?.data);
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

  useEffect(() => {
    return () => {
      for (const poller of Object.values(compactPollers.current)) {
        clearInterval(poller);
      }
      compactPollers.current = {};
    };
  }, []);

  const clearCompactPoller = (sessionKey: string) => {
    const poller = compactPollers.current[sessionKey];
    if (poller) {
      clearInterval(poller);
      delete compactPollers.current[sessionKey];
    }
  };

  const pollCompactionJob = async (sessionKey: string, jobId: string) => {
    try {
      const res = await fetch(`/api/mc/agents/sessions/compact/status/${jobId}`);
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Failed to read compaction status");

      const status = String(data?.status || "").toLowerCase();
      const outcome = String(data?.outcome || "").toLowerCase();
      const nextState = mapCompactState(status, outcome);

      setCompactStates((prev) => ({ ...prev, [sessionKey]: nextState }));

      const note = typeof data?.reason === "string" ? data.reason : undefined;
      if (note) {
        setSessionNotes((prev) => ({ ...prev, [sessionKey]: note }));
      }

      if (["compacted", "no_change", "force_reduced", "failed", "cancelled"].includes(nextState)) {
        clearCompactPoller(sessionKey);
        await loadMainSessions();
      }
    } catch (error: any) {
      clearCompactPoller(sessionKey);
      setCompactStates((prev) => ({ ...prev, [sessionKey]: "failed" }));
      setSessionNotes((prev) => ({
        ...prev,
        [sessionKey]: typeof error?.message === "string" ? error.message : "Compaction status check failed",
      }));
    }
  };

  const startCompaction = async (sessionKey: string) => {
    clearCompactPoller(sessionKey);
    setCompactStates((prev) => ({ ...prev, [sessionKey]: "starting" }));
    setSessionNotes((prev) => ({ ...prev, [sessionKey]: undefined }));

    try {
      const res = await fetch("/api/mc/agents/sessions/compact/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionKey, mode: "compact" }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Failed to start compaction job");

      const jobId = String(data?.jobId || "");
      if (!jobId) throw new Error("Compaction job id missing");

      setCompactStates((prev) => ({ ...prev, [sessionKey]: "queued" }));

      await pollCompactionJob(sessionKey, jobId);
      compactPollers.current[sessionKey] = setInterval(() => {
        void pollCompactionJob(sessionKey, jobId);
      }, 1500);
    } catch (error: any) {
      setCompactStates((prev) => ({ ...prev, [sessionKey]: "failed" }));
      setSessionNotes((prev) => ({
        ...prev,
        [sessionKey]: typeof error?.message === "string" ? error.message : "Compaction failed",
      }));
    }
  };

  const runResetAction = async (sessionKey: string) => {
    const loadingKey = `reset:${sessionKey}`;
    setSessionLoading((prev) => ({ ...prev, [loadingKey]: true }));
    setSessionNotes((prev) => ({ ...prev, [sessionKey]: undefined }));

    try {
      const res = await fetch("/api/mc/agents/sessions/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionKey }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Failed");

      setSessionLoading((prev) => ({ ...prev, [loadingKey]: "success" }));
      await loadMainSessions();
      setTimeout(() => {
        setSessionLoading((prev) => {
          const next = { ...prev };
          delete next[loadingKey];
          return next;
        });
      }, 1500);
    } catch (error: any) {
      setSessionLoading((prev) => {
        const next = { ...prev };
        delete next[loadingKey];
        return next;
      });
      const message = typeof error?.message === "string" ? error.message : "Reset failed";
      setSessionNotes((prev) => ({ ...prev, [sessionKey]: message }));
    }
  };

  const knownNames = Object.keys(agentMeta);
  const mapByName = new Map((agents || []).map((a: any) => [normalizeAgentId(a.name), a]));
  const baseList = knownNames.map((name) => mapByName.get(name) || { name });

  const mainSessionByAgent = useMemo(() => {
    const map = new Map<string, MainSessionRow>();
    for (const s of mainSessions) {
      const normalized = normalizeAgentId(s.agent);
      if (normalized) map.set(normalized, s);
    }
    return map;
  }, [mainSessions]);

  // Merge live status into agent data
  const agentList = baseList.map((agent: any) => {
    const normalizedName = normalizeAgentId(agent.name);
    const live = normalizedName ? liveStatuses.get(normalizedName) : undefined;
    const mainSession = normalizedName ? mainSessionByAgent.get(normalizedName) : undefined;

    return {
      ...agent,
      status: live?.status || agent.status,
      // Keep the card model sourced from OpenClaw config; runtime session model already shows in Main Session Health.
      model: agent.model,
      lastActiveAt: mainSession?.lastActiveAt ?? null,
    };
  });

  return (
    <div className="mx-auto max-w-[1200px]">
      {/* Hierarchy: Derrick at top, team below */}
      <div className="mb-6">
        <p className="mb-4 text-xs text-foreground-400 uppercase tracking-wider">
          Founder
        </p>
        <AgentCard
          agent={agentList.find((a: any) => a.name === "derrick") || { name: "derrick" }}
          meta={agentMeta.derrick}
        />
      </div>

      <div className="mb-2 flex items-center gap-3">
        <div className="h-px flex-1 bg-divider" />
        <span className="text-xs text-foreground-300">reports to</span>
        <div className="h-px flex-1 bg-divider" />
      </div>

      <div className="mb-4">
        <p className="mb-4 text-xs text-foreground-400 uppercase tracking-wider">
          Team
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          {agentList
            .filter((a: any) => a.name !== "derrick")
            .map((agent: any) => (
              <AgentCard
                key={agent.name}
                agent={agent}
                meta={agentMeta[normalizeAgentId(agent.name) || ""]}
              />
            ))}
        </div>
      </div>

      <div className="mb-6 rounded border border-divider bg-white dark:bg-[#0A0A0A]">
        <div className="border-b border-divider px-4 py-2.5">
          <p className="text-xs uppercase tracking-wider text-foreground-400">Main Session Health</p>
          <p className="mt-1 text-[11px] text-foreground-300">
            Forward-looking cost estimates based on current session occupancy and recent median output. For historical spend, see the Activity tab.
          </p>
        </div>
        {mainSessions.length === 0 ? (
          <p className="px-4 py-5 text-xs text-foreground-300">No active main sessions.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-divider text-foreground-400 uppercase tracking-wider">
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
              <tbody className="divide-y divide-divider dark:divide-[#161616]">
                {mainSessions.map((s) => {
                  const contextTokens = Math.max(0, Number(s.contextTokens ?? s.totalTokens ?? 0));
                  const contextWindow = Math.max(1, Number(s.contextWindow ?? s.maxContext ?? 1));
                  const pct = Math.min((contextTokens / contextWindow) * 100, 100);
                  const bar = pct > 80 ? "#ef4444" : pct > 55 ? "#f59e0b" : "#22c55e";
                  return (
                    <tr key={s.sessionKey} className="hover:bg-gray-50 dark:hover:bg-[#0D0D0D] transition-colors">
                      <td className="px-4 py-2 capitalize text-foreground dark:text-white">{s.agent}</td>
                      <td className="px-4 py-2 font-mono text-foreground-500 dark:text-[#BBBBBB]">{s.model}</td>
                      <td className="px-4 py-2" title={`${contextTokens.toLocaleString()} / ${contextWindow.toLocaleString()} tokens`}>
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-32 overflow-hidden rounded-full bg-gray-200 dark:bg-[#222222]">
                            <div className="h-full" style={{ width: `${pct}%`, backgroundColor: bar }} />
                          </div>
                          <span className="font-mono text-foreground-500 dark:text-[#BBBBBB]">{Math.round(pct)}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-foreground-400 dark:text-[#999999]">{formatLastActiveRelative(s.lastActiveAt)}</td>
                      <td className="px-4 py-2 text-right font-mono text-foreground dark:text-white">${(s.estimatedNextTaskCostUsd || 0).toFixed(4)}</td>
                      <td className="px-4 py-2">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <SessionActionButton
                              action="compact"
                              compactState={compactStates[s.sessionKey]}
                              onClick={() => startCompaction(s.sessionKey)}
                            />
                            <SessionActionButton
                              action="reset"
                              loadingState={sessionLoading[`reset:${s.sessionKey}`]}
                              onClick={() => setResetConfirmSessionKey(s.sessionKey)}
                            />
                          </div>
                          {sessionNotes[s.sessionKey] ? (
                            <p className="max-w-[280px] text-[10px] text-foreground-400 dark:text-[#8F8F8F]">{sessionNotes[s.sessionKey]}</p>
                          ) : null}
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

      <CronCalendarSection initialJobs={initialCronJobs} />

      <Modal
        isOpen={!!resetConfirmSessionKey}
        onClose={() => setResetConfirmSessionKey(null)}
        className="bg-white dark:bg-[#121212] text-foreground dark:text-white"
      >
        <ModalContent>
          <ModalHeader className="border-b border-divider text-sm">Reset main session?</ModalHeader>
          <ModalBody className="py-4">
            <p className="text-sm text-foreground-600 dark:text-[#CCCCCC]">This clears the current context for this agent&apos;s main session.</p>
          </ModalBody>
          <ModalFooter className="border-t border-divider">
            <Button size="sm" variant="flat" onPress={() => setResetConfirmSessionKey(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              color="danger"
              onPress={() => {
                const sessionKey = resetConfirmSessionKey;
                setResetConfirmSessionKey(null);
                if (sessionKey) runResetAction(sessionKey);
              }}
            >
              Reset
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}

function SessionActionButton({
  action,
  loadingState,
  compactState,
  onClick,
}: {
  action: "compact" | "reset";
  loadingState?: boolean | "success";
  compactState?: CompactState;
  onClick: () => void;
}) {
  const baseStyles = "flex items-center justify-center gap-1.5 rounded px-2.5 py-1.5 text-[11px] font-medium transition-all duration-200 min-w-[92px]";
  const variantStyles = action === "compact"
    ? "border border-divider bg-white dark:bg-[#111111] hover:bg-gray-100 dark:hover:bg-[#1a1a1a] text-foreground dark:text-white"
    : "border border-danger-200 dark:border-danger-900/50 bg-danger-50 dark:bg-danger-900/10 hover:bg-danger-100 dark:hover:bg-danger-900/20 text-danger-600 dark:text-danger-400";

  if (action === "compact") {
    const isWorking = compactState === "starting" || compactState === "queued" || compactState === "running";

    const compactLabel = () => {
      if (compactState === "starting" || compactState === "queued" || compactState === "running") {
        return (
          <>
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Compacting...</span>
          </>
        );
      }
      if (compactState === "compacted") {
        return (
          <>
            <Check className="h-3 w-3" />
            <span>Compacted</span>
          </>
        );
      }
      if (compactState === "no_change") {
        return (
          <>
            <Minus className="h-3 w-3" />
            <span>No change</span>
          </>
        );
      }
      if (compactState === "force_reduced") {
        return (
          <>
            <Zap className="h-3 w-3" />
            <span>Force-reduced</span>
          </>
        );
      }
      if (compactState === "failed") {
        return (
          <>
            <XCircle className="h-3 w-3" />
            <span>Failed</span>
          </>
        );
      }
      if (compactState === "cancelled") {
        return (
          <>
            <Minus className="h-3 w-3" />
            <span>Cancelled</span>
          </>
        );
      }
      return <span>Compact</span>;
    };

    return (
      <button
        onClick={onClick}
        disabled={isWorking}
        className={`${baseStyles} ${variantStyles} ${isWorking ? "opacity-50 cursor-not-allowed pointer-events-none" : ""}`}
      >
        {compactLabel()}
      </button>
    );
  }

  const isLoading = loadingState === true;
  const isSuccess = loadingState === "success";

  return (
    <button
      onClick={onClick}
      disabled={!!loadingState}
      className={`${baseStyles} ${variantStyles} ${loadingState ? "opacity-50 cursor-not-allowed pointer-events-none" : ""}`}
    >
      {isLoading ? (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Resetting...</span>
        </>
      ) : isSuccess ? (
        <>
          <Check className="h-3 w-3" />
          <span>Reset!</span>
        </>
      ) : (
        <span>Reset</span>
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

const liveStatusConfig: Record<string, { color: "success" | "warning" | "default" | "primary" | "secondary"; label: string; pulse?: boolean }> = {
  thinking: { color: "secondary", label: "Thinking", pulse: true },
};

const attentionConfig: Record<string, { color: "danger"; label: string }> = {
  aborted_last_run: { color: "danger", label: "Aborted last run" },
};

function getModelPrimary(model?: string | { primary?: string; fallbacks?: string[]; label?: string } | null): string {
  if (!model) return "";

  if (typeof model === "string") return model;
  if (typeof model.primary === "string") return model.primary;
  if (Array.isArray(model.fallbacks) && typeof model.fallbacks[0] === "string") return model.fallbacks[0];
  return "";
}

function formatModel(model?: string | { primary?: string; fallbacks?: string[]; label?: string } | null): string {
  if (!model) return "";

  if (typeof model === "object" && typeof model.label === "string" && model.label.trim()) {
    return model.label.trim();
  }

  const rawModel = getModelPrimary(model);
  if (!rawModel) return "";

  const name = rawModel.split("/").pop() || rawModel;
  return name
    .replace(/^claude-/, "Claude ")
    .replace(/^gemini-/, "Gemini ")
    .replace(/^gpt-/, "GPT ")
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
  const isHuman = agent.name === "derrick";
  const activity = activityStateConfig[agent.activityState] || activityStateConfig.uninitialized;
  const liveStatus = liveStatusConfig[String(agent.status || "").toLowerCase()] || null;
  const chipStatus = liveStatus || activity;
  const attention = agent.attention !== "none" ? attentionConfig[agent.attention] : null;
  const avatarUrl = resolveAgentAvatarUrl(agent.name, agent.avatarUrl) || undefined;

  return (
    <Card className="border border-divider bg-white dark:bg-content1">
      <CardBody className="p-4 text-foreground">
        <div className="flex items-start gap-3">
          {avatarUrl ? (
            <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded border border-divider">
              <StableImage
                src={avatarUrl}
                alt={agent.name}
                width={40}
                height={40}
                fit="cover"
                className="h-full w-full"
              />
            </div>
          ) : (
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded bg-gray-100 dark:bg-[#1A1A1A] text-muted-foreground">
              <IconComponent size={20} strokeWidth={1.5} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium capitalize">{agent.name}</h3>
              {!isHuman && (
                <>
                  <Chip
                    size="sm"
                    variant="flat"
                    color={chipStatus.color as any}
                    className={`text-[10px] h-5 ${chipStatus.pulse ? "animate-pulse" : ""}`}
                  >
                    {chipStatus.label}
                  </Chip>
                  <Tooltip
                    placement="right"
                    content={
                      <div className="max-w-xs text-xs leading-relaxed">
                        <div><strong>Thinking</strong>: active in last ~30s (currently in run loop).</div>
                        <div><strong>Active (green)</strong>: activity in last ~2 minutes.</div>
                        <div><strong>Active (purple)</strong>: recently active (2–15 minutes).</div>
                        <div><strong>Idle</strong>: last activity 15 minutes to 24 hours.</div>
                        <div><strong>Stale</strong>: no activity for 24+ hours.</div>
                        <div><strong>No session</strong>: main session not initialized.</div>
                      </div>
                    }
                  >
                    <button className="text-foreground-300 hover:text-foreground-500" aria-label="Team status help">
                      <CircleHelp size={13} strokeWidth={1.75} />
                    </button>
                  </Tooltip>
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
                </>
              )}
            </div>
            <p className="text-xs text-foreground-400 mt-0.5">
              {meta?.role || "Agent"}
            </p>
            {agent.model && (() => {
              const primaryModel = getModelPrimary(agent.model);
              const modelLabel = formatModel(agent.model);
              return (
                <div className="mt-0.5">
                  <p className="text-[11px] text-foreground-300 font-mono" title={modelLabel || primaryModel}>
                    {primaryModel || modelLabel}
                  </p>
                  {modelLabel && modelLabel !== primaryModel ? (
                    <p className="text-[10px] text-foreground-400">
                      {modelLabel}
                    </p>
                  ) : null}
                </div>
              );
            })()}
            <p className="text-xs text-foreground-300 mt-2 line-clamp-2">
              {meta?.description || ""}
            </p>
            {!isHuman && (
              <div className="mt-2 border-t border-divider pt-2">
                <p className="text-[10px] uppercase tracking-wider text-foreground-400">
                  {String(agent.status || "").toLowerCase() === "thinking"
                    ? "Processing"
                    : agent.activityState === "active"
                      ? "Processing"
                      : "Last active"}
                </p>
                <p className="text-xs text-foreground-500 dark:text-[#BBBBBB] mt-0.5">
                  {String(agent.status || "").toLowerCase() === "thinking"
                    ? "Working now"
                    : agent.activityState === "active"
                      ? "Working now"
                      : formatLastActiveRelative(agent.lastActiveAt)}
                </p>
              </div>
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
