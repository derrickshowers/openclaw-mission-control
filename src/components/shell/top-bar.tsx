"use client";

import { usePathname } from "next/navigation";
import { Umbrella } from "lucide-react";
import { useSSEStatus } from "@/hooks/use-sse";

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/tasks": "Tasks",
  "/team": "Team",
  "/memory": "Memory",
  "/calendar": "Calendar",
  "/docs": "Docs",
  "/activity": "Activity",
};

export function TopBar() {
  const pathname = usePathname();
  const connected = useSSEStatus();

  const title =
    pageTitles[pathname] ||
    Object.entries(pageTitles).find(([key]) =>
      pathname.startsWith(key) && key !== "/"
    )?.[1] ||
    "Dashboard";

  const openCommandPalette = () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
  };

  return (
    <header className="mx-2 mt-2 flex h-14 items-center justify-between rounded-xl border border-divider bg-content1/50 px-4 backdrop-blur-xl lg:mx-3 lg:px-5">
      <div className="flex items-center gap-3">
        <Umbrella size={16} strokeWidth={1.5} className="lg:hidden text-foreground-400" />
        <h1 className="text-sm font-medium">{title}</h1>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5" title={connected ? "Live" : "Reconnecting..."}>
          <div className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-success" : "bg-danger animate-pulse"}`} />
          <span className="text-[10px] text-foreground-500 hidden lg:inline">
            {connected ? "Live" : "Offline"}
          </span>
        </div>
        <button 
          onClick={openCommandPalette}
          className="hidden lg:inline-flex items-center gap-1 rounded border border-divider bg-default-100 px-2 py-0.5 text-xs text-foreground-400 hover:bg-default-200 transition-colors"
        >
          ⌘K
        </button>
      </div>
    </header>
  );
}
