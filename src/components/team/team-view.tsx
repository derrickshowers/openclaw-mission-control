"use client";

import { useState, useEffect } from "react";
import { Card, CardBody, CardHeader, Chip, Button, Textarea } from "@heroui/react";
import { Crosshair, Landmark, Zap, Palette, Bot, X, Send, BookOpen } from "lucide-react";
import { useSSE } from "@/hooks/use-sse";
import type { LucideIcon } from "lucide-react";

const agentMeta: Record<string, { role: string; description: string; Icon: LucideIcon; avatar?: string }> = {
  frank: {
    role: "Orchestrator",
    description: "Routes tasks, manages the team, delivers results to Derrick. The glue.",
    Icon: Crosshair,
    avatar: "/avatars/frank.png",
  },
  tom: {
    role: "Lead Architect",
    description: "System design, technical specs, infrastructure decisions, code review.",
    Icon: Landmark,
    avatar: "/avatars/tom.png",
  },
  michael: {
    role: "Full Stack Engineer",
    description: "Builds things. React, Next.js, TypeScript, APIs, the full stack.",
    Icon: Zap,
    avatar: "/avatars/michael.png",
  },
  joanna: {
    role: "UX/Product Designer",
    description: "User experience, design direction, interaction patterns, accessibility.",
    Icon: Palette,
    avatar: "/avatars/joanna.png",
  },
};

interface TeamViewProps {
  agents: any[];
}

export function TeamView({ agents }: TeamViewProps) {
  const [messageTarget, setMessageTarget] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const [liveStatuses, setLiveStatuses] = useState<Map<string, any>>(new Map());

  const { lastEvent } = useSSE("agent.status");

  useEffect(() => {
    if (!lastEvent?.data?.agent) return;
    setLiveStatuses((prev) => {
      const next = new Map(prev);
      next.set(lastEvent.data.agent, lastEvent.data);
      return next;
    });
  }, [lastEvent]);

  const baseList = agents.length > 0
    ? agents
    : Object.keys(agentMeta).map((name) => ({ name }));

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
      {/* Hierarchy: Frank at top, team below */}
      <div className="mb-6">
        <p className="mb-4 text-xs text-[#888888] uppercase tracking-wider">
          Orchestrator
        </p>
        <AgentCard
          agent={agentList.find((a: any) => a.name === "frank") || { name: "frank" }}
          meta={agentMeta.frank}
          onMessage={() => setMessageTarget("frank")}
        />
      </div>

      <div className="mb-2 flex items-center gap-3">
        <div className="h-px flex-1 bg-[#222222]" />
        <span className="text-xs text-[#555555]">reports to</span>
        <div className="h-px flex-1 bg-[#222222]" />
      </div>

      <div className="mb-4">
        <p className="mb-4 text-xs text-[#888888] uppercase tracking-wider">
          Specialists
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          {agentList
            .filter((a: any) => a.name !== "frank")
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
  meta: { role: string; description: string; Icon: LucideIcon; avatar?: string };
  onMessage: () => void;
}) {
  const IconComponent = meta?.Icon || Bot;
  const { color, label, pulse } = statusConfig[agent.status] || statusConfig.idle;

  return (
    <Card className="border border-[#222222] bg-[#121212]">
      <CardBody className="p-4">
        <div className="flex items-start gap-3">
          {meta?.avatar ? (
            <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg">
              <img
                src={meta.avatar}
                alt={agent.name}
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[#1A1A1A] text-muted-foreground">
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
