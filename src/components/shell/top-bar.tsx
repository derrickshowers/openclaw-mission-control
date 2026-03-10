"use client";

import { usePathname } from "next/navigation";
import { Umbrella, Search } from "lucide-react";
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

  return (
    <header className="mx-2 mt-2 flex h-14 items-center justify-between rounded-xl border border-white/10 bg-black/35 px-4 backdrop-blur-xl lg:mx-3 lg:px-5">
      <div className="flex items-center gap-3">
        <Umbrella size={16} strokeWidth={1.5} className="lg:hidden text-muted-foreground" />
        <h1 className="text-sm font-medium">{title}</h1>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5" title={connected ? "Live" : "Reconnecting..."}>
          <div className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-green-500" : "bg-red-500 animate-pulse"}`} />
          <span className="text-[10px] text-[#555555] hidden lg:inline">
            {connected ? "Live" : "Offline"}
          </span>
        </div>
        <kbd className="hidden lg:inline-flex items-center gap-1 rounded border border-[#222222] bg-[#121212] px-2 py-0.5 text-xs text-[#888888]">
          ⌘K
        </kbd>
      </div>
    </header>
  );
}
