"use client";

import { useState, useEffect } from "react";
import { formatLocalTime as formatLocalTimeShared } from "@/lib/dates";
import { Card, CardBody, CardHeader, Chip, Button, Textarea } from "@heroui/react";
import { Crown, Crosshair, Landmark, Zap, Palette, Bot, X, Send, BookOpen } from "lucide-react";
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
};

function resolveAvatarUrl(url?: string, agentName?: string): string | undefined {
  if (agentName === "derrick") return "/images/team/derrick.jpg";
  if (!url) return undefined;
  if (url.startsWith('/api/agents/')) return url.replace('/api/agents/', '/api/mc/agents/');
  return url;
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
  lastActiveAt?: string;
}

interface TeamViewProps {
  agents: any[];
}

export function TeamView({ agents }: TeamViewProps) {
  const [messageTarget, setMessageTarget] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const [liveStatuses, setLiveStatuses] = useState<Map<string, any>>(new Map());
  const [mainSessions, setMainSessions] = useState<MainSessionRow[]>([]);
  const [sessionLoading, setSessionLoading] = useState<Record<string, boolean>>({});

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
  }, []);

  const runSessionAction = async (sessionKey: string, action: "compact" | "reset") => {
    if (action === "reset" && !confirm("Reset this main session? This clears current context.")) return;
    setSessionLoading((prev) => ({ ...prev, [`${action}:${sessionKey}`]: true }));
    try {
      await fetch(`/api/mc/agents/sessions/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionKey }),
      });
      await loadMainSessions();
    } finally {
      setSessionLoading((prev) => ({ ...prev, [`${action}:${sessionKey}`]: false }));
    }
  };

  const knownNames = Object.keys(agentMeta);
  const mapByName = new Map((agents || []).map((a: any) => [a.name, a]));
  const baseList = knownNames.map((name) => mapByName.get(name) || { name });

  // Merge live status into agent data
  const agentList = baseList.map((agent: any) => {
    const live = liveStatuses.get(agent.name);
    if (!live) return agent;
    return {
      ...agent,
      status: live.status || agent.status,
      model: live.model || agent.model,
      currentTask: live.currentTask || agent.currentTask,
    };
  });

  const sendMessage = async () => {
    if (!messageTarget || !messageText.trim()) return;
    setSending(true);
    try {
      await fetch(`/api/mc/agents/${messageTarget}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: messageText }),
      });
      setMessageText("");
      setMessageTarget(null);
    } catch (err) {
      console.error("Failed to send:", err);
    } finally {
      setSending(false);
    }
  };

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
          onMessage={() => setMessageTarget("derrick")}
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
                onMessage={() => setMessageTarget(agent.name)}
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
                  <th className="px-4 py-2 text-left">Last Activity</th>
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
                      <td className="px-4 py-2 text-[#999999]">{s.lastActiveAt ? formatLocalTimeShared(s.lastActiveAt) : "—"}</td>
                      <td className="px-4 py-2 text-right font-mono text-white">${(s.estimatedNextTaskCostUsd || 0).toFixed(4)}</td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <button className="rounded border border-[#333333] bg-[#111111] px-2 py-1 text-[11px]" onClick={() => runSessionAction(s.sessionKey, "compact")} disabled={!!sessionLoading[`compact:${s.sessionKey}`]}>Compact</button>
                          <button className="rounded border border-[#4b1f1f] bg-[#1b0f0f] px-2 py-1 text-[11px] text-[#fca5a5]" onClick={() => runSessionAction(s.sessionKey, "reset")} disabled={!!sessionLoading[`reset:${s.sessionKey}`]}>Reset</button>
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

      {/* Send Message Panel */}
      {messageTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md border border-[#222222] bg-[#121212]">
            <CardHeader className="border-b border-[#222222] px-4 py-3 flex items-center justify-between">
              <h3 className="text-sm font-medium">
                Send to {messageTarget}
              </h3>
              <button
                onClick={() => setMessageTarget(null)}
                className="text-[#888888] hover:text-white"
              >
                <X size={16} strokeWidth={1.5} />
              </button>
            </CardHeader>
            <CardBody className="p-4 space-y-3">
              <Textarea
                placeholder="Type your message..."
                value={messageText}
                onValueChange={setMessageText}
                variant="bordered"
                minRows={3}
                classNames={{ inputWrapper: "border-[#222222] bg-[#080808]" }}
              />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="flat" onPress={() => setMessageTarget(null)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  color="primary"
                  onPress={sendMessage}
                  isLoading={sending}
                  isDisabled={!messageText.trim()}
                >
                  Send
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}

const statusConfig: Record<string, { color: "success" | "warning" | "default" | "primary"; label: string; pulse?: boolean }> = {
  thinking: { color: "success", label: "thinking", pulse: true },
  active: { color: "success", label: "active" },
  working: { color: "warning", label: "working" },
  idle: { color: "default", label: "idle" },
  sleeping: { color: "default", label: "sleeping" },
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
  onMessage,
}: {
  agent: any;
  meta: { role: string; description: string; Icon: LucideIcon };
  onMessage: () => void;
}) {
  const IconComponent = meta?.Icon || Bot;
  const { color, label, pulse } = statusConfig[agent.status] || statusConfig.idle;
  const avatarUrl = resolveAvatarUrl(agent.avatarUrl, agent.name);

  return (
    <Card className="border border-[#222222] bg-[#121212]">
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
                color={color}
                className={`text-[10px] h-5 ${pulse ? "animate-pulse" : ""}`}
              >
                {label}
              </Chip>
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
            {agent.currentTask && (
              <div className="mt-2 rounded bg-[#1A1A1A] px-2 py-1.5 border border-[#222222]">
                <p className="text-[10px] text-[#888888] uppercase tracking-wider">Current task</p>
                <p className="text-xs text-[#cccccc] mt-0.5 truncate">{agent.currentTask.title}</p>
              </div>
            )}
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <Button
            size="sm"
            variant="flat"
            className="text-xs border border-[#222222] bg-[#080808]"
            onPress={onMessage}
            startContent={<Send size={14} strokeWidth={1.5} />}
          >
            Message
          </Button>
          <Button
            size="sm"
            variant="flat"
            className="text-xs border border-[#222222] bg-[#080808]"
            as="a"
            href={`/memory?agent=${agent.name}`}
            startContent={<BookOpen size={14} strokeWidth={1.5} />}
          >
            Memory
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
