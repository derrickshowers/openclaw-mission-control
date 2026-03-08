"use client";

import { useState } from "react";
import { Card, CardBody, CardHeader, Chip, Button, Textarea } from "@heroui/react";

const agentMeta: Record<string, { role: string; description: string; icon: string }> = {
  frank: {
    role: "Orchestrator",
    description: "Routes tasks, manages the team, delivers results to Derrick. The glue.",
    icon: "🎯",
  },
  tom: {
    role: "Lead Architect",
    description: "System design, technical specs, infrastructure decisions, code review.",
    icon: "🏗️",
  },
  michael: {
    role: "Full Stack Engineer",
    description: "Builds things. React, Next.js, TypeScript, APIs, the full stack.",
    icon: "⚡",
  },
  joanna: {
    role: "UX/Product Designer",
    description: "User experience, design direction, interaction patterns, accessibility.",
    icon: "🎨",
  },
};

interface TeamViewProps {
  agents: any[];
}

export function TeamView({ agents }: TeamViewProps) {
  const [messageTarget, setMessageTarget] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);

  const agentList = agents.length > 0
    ? agents
    : Object.keys(agentMeta).map((name) => ({ name }));

  const sendMessage = async () => {
    if (!messageTarget || !messageText.trim()) return;
    setSending(true);
    try {
      await fetch(`/api/proxy/agents/${messageTarget}/message`, {
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
                className="text-[#888888] hover:text-white text-sm"
              >
                ✕
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

function AgentCard({
  agent,
  meta,
  onMessage,
}: {
  agent: any;
  meta: { role: string; description: string; icon: string };
  onMessage: () => void;
}) {
  return (
    <Card className="border border-[#222222] bg-[#121212]">
      <CardBody className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[#1A1A1A] text-lg">
            {agent.identity?.emoji || meta?.icon || "🤖"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium capitalize">{agent.name}</h3>
              <Chip size="sm" variant="flat" color="default" className="text-[10px] h-5">
                idle
              </Chip>
            </div>
            <p className="text-xs text-[#888888] mt-0.5">
              {meta?.role || "Agent"}
            </p>
            <p className="text-xs text-[#555555] mt-2 line-clamp-2">
              {meta?.description || ""}
            </p>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <Button
            size="sm"
            variant="flat"
            className="text-xs border border-[#222222] bg-[#080808]"
            onPress={onMessage}
          >
            Message
          </Button>
          <Button
            size="sm"
            variant="flat"
            className="text-xs border border-[#222222] bg-[#080808]"
            as="a"
            href={`/memory?agent=${agent.name}`}
          >
            Memory
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
