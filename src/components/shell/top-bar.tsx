"use client";

import { usePathname } from "next/navigation";

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/tasks": "Tasks",
  "/team": "Team",
  "/memory": "Memory",
  "/activity": "Activity",
};

export function TopBar() {
  const pathname = usePathname();

  const title =
    pageTitles[pathname] ||
    Object.entries(pageTitles).find(([key]) =>
      pathname.startsWith(key) && key !== "/"
    )?.[1] ||
    "Dashboard";

  return (
    <header className="flex h-14 items-center justify-between border-b border-[#222222] px-4 lg:px-6">
      <div className="flex items-center gap-3">
        <span className="lg:hidden text-sm font-semibold">☔</span>
        <h1 className="text-sm font-medium">{title}</h1>
      </div>
      <div className="flex items-center gap-2">
        <kbd className="hidden lg:inline-flex items-center gap-1 rounded border border-[#222222] bg-[#121212] px-2 py-0.5 text-xs text-[#888888]">
          ⌘K
        </kbd>
      </div>
    </header>
  );
}
