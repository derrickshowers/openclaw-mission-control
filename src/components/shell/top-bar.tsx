"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Popover, PopoverContent, PopoverTrigger } from "@heroui/react";
import { usePathname } from "next/navigation";
import { RefreshCw, Umbrella } from "lucide-react";
import { useSSEStatus } from "@/hooks/use-sse";
import { api } from "@/lib/api";

const pageTitles: Record<string, string> = {
  "/": "Today",
  "/environment": "Environment",
  "/inbox": "Inbox",
  "/tasks": "Team",
  "/team": "Agents",
  "/memory": "Memory",
  "/time": "Time Logging",
  "/calendar": "Time Logging",
  "/docs": "Docs",
  "/activity": "Activity",
};

type OpenClawHealth = {
  gateway?: string;
};

type StatusItem = {
  name: string;
  value: string;
  description: string;
  indicatorClass: string;
};

function StatusRow({ name, value, description, indicatorClass }: StatusItem) {
  return (
    <div className="flex items-center gap-2" title={description}>
      <div className={`h-1.5 w-1.5 rounded-full ${indicatorClass}`} />
      <div className="flex items-baseline gap-1.5 leading-none">
        <span className="text-[10px] font-medium text-foreground-700 dark:text-foreground-300">
          {name}
        </span>
        <span className="text-[10px] text-foreground-500">{value}</span>
      </div>
    </div>
  );
}

export function TopBar() {
  const pathname = usePathname();
  const connected = useSSEStatus();
  const [openClawRunning, setOpenClawRunning] = useState<boolean | null>(null);

  const refreshOpenClawHealth = useCallback(async () => {
    try {
      const health = await api.getHealth() as OpenClawHealth;
      setOpenClawRunning(health.gateway === "connected");
    } catch {
      setOpenClawRunning(false);
    }
  }, []);

  const title =
    pageTitles[pathname] ||
    Object.entries(pageTitles).find(([key]) =>
      pathname.startsWith(key) && key !== "/"
    )?.[1] ||
    "Dashboard";

  const refreshPage = () => {
    window.location.reload();
  };

  useEffect(() => {
    const initialCheck = window.setTimeout(() => {
      void refreshOpenClawHealth();
    }, 0);

    const interval = window.setInterval(() => {
      void refreshOpenClawHealth();
    }, 30_000);

    return () => {
      window.clearTimeout(initialCheck);
      window.clearInterval(interval);
    };
  }, [refreshOpenClawHealth]);

  const openClawLabel =
    openClawRunning === null
      ? "Checking"
      : openClawRunning
        ? "Running"
        : "Down";

  const openClawIndicatorClass =
    openClawRunning === null
      ? "bg-zinc-400 animate-pulse"
      : openClawRunning
        ? "bg-success"
        : "bg-danger animate-pulse";

  const missionControlStatus: StatusItem = {
    name: "Mission Control",
    value: connected ? "Live" : "Offline",
    description: connected ? "Mission Control activity stream is connected" : "Mission Control activity stream is reconnecting",
    indicatorClass: connected ? "bg-success" : "bg-danger animate-pulse",
  };

  const openClawStatus: StatusItem = {
    name: "OpenClaw",
    value: openClawLabel,
    description:
      openClawRunning === null
        ? "Checking OpenClaw instance..."
        : openClawRunning
          ? "OpenClaw instance is running"
          : "OpenClaw instance is unavailable",
    indicatorClass: openClawIndicatorClass,
  };

  return (
    <header className="standalone-topbar mx-2 mt-2 flex h-14 items-center justify-between rounded-xl border border-divider bg-content1/50 px-4 backdrop-blur-xl lg:mx-3 lg:px-5">
      <div className="flex items-center gap-3">
        <Umbrella size={16} strokeWidth={1.5} className="text-foreground-400 lg:hidden" />
        <h1 className="text-sm font-medium">{title}</h1>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex flex-col items-end gap-1">
          <StatusRow {...missionControlStatus} />
          <StatusRow {...openClawStatus} />
        </div>
        <div className="sm:hidden">
          <Popover placement="bottom-end">
            <PopoverTrigger>
              <Button
                size="sm"
                variant="flat"
                className="min-w-0 border border-divider bg-default-100 px-2 text-foreground-600"
              >
                <div className="flex items-center gap-2">
                  <div className="flex flex-col gap-1">
                    <div className={`h-1.5 w-1.5 rounded-full ${missionControlStatus.indicatorClass}`} />
                    <div className={`h-1.5 w-1.5 rounded-full ${openClawStatus.indicatorClass}`} />
                  </div>
                  <span className="text-xs">Status</span>
                </div>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="min-w-[210px] p-3">
              <div className="flex flex-col gap-2">
                <StatusRow {...missionControlStatus} />
                <StatusRow {...openClawStatus} />
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <button
          onClick={refreshPage}
          className="inline-flex items-center gap-1 rounded border border-divider bg-default-100 px-2 py-1 text-xs text-foreground-500 transition-colors hover:bg-default-200 hover:text-foreground"
        >
          <RefreshCw size={12} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>
    </header>
  );
}
