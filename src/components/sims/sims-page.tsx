"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import type { Task } from "@/lib/api";
import { TaskDrawer } from "@/components/tasks/task-drawer";
import { findRoomAgent } from "./sims-room-state";
import { SimsInspectorPanel, SimsStatusStrip } from "./sims-overlays";
import type { SimsPanelTarget } from "./sims-types";
import { useSimsData } from "./use-sims-data";

const SimsCanvas = dynamic(
  () => import("./sims-canvas").then((mod) => mod.SimsCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[760px] items-center justify-center rounded-[28px] border border-zinc-200 bg-[#efe6d6] text-sm text-zinc-600 dark:border-white/10 dark:text-zinc-300">
        Loading Environment…
      </div>
    ),
  },
);

interface SimsPageProps {
  initialAgents: unknown[];
  initialBlockedTasks: Task[];
  initialActiveTasks: Task[];
}

export function SimsPage({
  initialAgents,
  initialBlockedTasks,
  initialActiveTasks,
}: SimsPageProps) {
  const { room, refreshing, refresh } = useSimsData({
    initialAgents,
    initialBlockedTasks,
    initialActiveTasks,
  });
  const [selectedTarget, setSelectedTarget] = useState<SimsPanelTarget>({ kind: "overview" });
  const [motionEnabled, setMotionEnabled] = useState(true);
  const [drawerTask, setDrawerTask] = useState<Task | null>(null);
  const [cameraResetToken, setCameraResetToken] = useState(0);

  const effectiveSelectedTarget = useMemo<SimsPanelTarget>(() => {
    if (selectedTarget.kind === "agent" && !findRoomAgent(room, selectedTarget.agentId)) {
      return { kind: "overview" };
    }
    return selectedTarget;
  }, [room, selectedTarget]);

  return (
    <div className="mx-auto flex max-w-[1680px] flex-col gap-3 pb-20">
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
        <SimsCanvas
          room={room}
          selectedTarget={effectiveSelectedTarget}
          onSelectTarget={setSelectedTarget}
          motionEnabled={motionEnabled}
          cameraResetToken={cameraResetToken}
        />
        <SimsInspectorPanel
          room={room}
          selectedTarget={effectiveSelectedTarget}
          onSelectTarget={setSelectedTarget}
          onOpenTask={setDrawerTask}
        />
      </div>

      <SimsStatusStrip
        room={room}
        refreshing={refreshing}
        motionEnabled={motionEnabled}
        onRefresh={() => void refresh()}
        onResetCamera={() => setCameraResetToken((value) => value + 1)}
        onToggleMotion={() => setMotionEnabled((prev) => !prev)}
      />
      {drawerTask ? (
        <TaskDrawer
          task={drawerTask}
          isOpen={!!drawerTask}
          onClose={() => setDrawerTask(null)}
          onUpdate={(updated) => {
            setDrawerTask(updated);
            void refresh();
          }}
        />
      ) : null}
    </div>
  );
}
