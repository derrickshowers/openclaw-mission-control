"use client";

import { useState } from "react";
import { UsageDashboard } from "@/components/activity/usage-dashboard";
import { LogsViewer } from "@/components/activity/logs-viewer";
import { TrendingUp, Terminal } from "lucide-react";

const TABS = [
  { id: "usage", label: "Usage", icon: TrendingUp },
  { id: "logs", label: "Logs", icon: Terminal },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function ActivityPage() {
  const [activeTab, setActiveTab] = useState<TabId>("usage");

  return (
    <div className="flex h-full flex-col">
      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-gray-200 dark:border-[#222222] px-4">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors border-b-2 -mb-px ${
                active
                  ? "border-gray-900 text-gray-900 dark:border-white dark:text-white"
                  : "border-transparent text-gray-400 dark:text-[#555555] hover:text-gray-500 dark:hover:text-[#888888]"
              }`}
            >
              <Icon size={13} strokeWidth={1.5} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden p-4">
        {activeTab === "usage" ? <UsageDashboard /> : <LogsViewer />}
      </div>
    </div>
  );
}
