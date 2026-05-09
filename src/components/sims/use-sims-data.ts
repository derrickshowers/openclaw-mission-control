"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type Task } from "@/lib/api";
import { useSSE } from "@/hooks/use-sse";
import { createSimsRoomState } from "./sims-room-state";

interface UseSimsDataOptions {
  initialAgents: unknown[];
  initialBlockedTasks: Task[];
  initialActiveTasks: Task[];
}

export function useSimsData({
  initialAgents,
  initialBlockedTasks,
  initialActiveTasks,
}: UseSimsDataOptions) {
  const [agents, setAgents] = useState<unknown[]>(initialAgents);
  const [blockedTasks, setBlockedTasks] = useState<Task[]>(initialBlockedTasks);
  const [activeTasks, setActiveTasks] = useState<Task[]>(initialActiveTasks);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const [nextAgents, nextBlockedTasks, nextActiveTasks] = await Promise.all([
        api.getAgents().catch(() => agents),
        api.getTasks({ status: "blocked" }).catch(() => blockedTasks),
        api.getTasks({ status: "in_progress" }).catch(() => activeTasks),
      ]);

      setAgents(Array.isArray(nextAgents) ? nextAgents : []);
      setBlockedTasks(nextBlockedTasks);
      setActiveTasks(nextActiveTasks);
    } finally {
      setRefreshing(false);
    }
  }, [activeTasks, agents, blockedTasks]);

  const { lastEvent } = useSSE([
    "agent.status",
    "task.created",
    "task.updated",
    "task.deleted",
    "task.moved",
  ]);

  useEffect(() => {
    if (!lastEvent) return;
    void refresh();
  }, [lastEvent, refresh]);

  const room = useMemo(
    () => createSimsRoomState({ agents, blockedTasks, activeTasks }),
    [activeTasks, agents, blockedTasks],
  );

  return {
    room,
    refreshing,
    refresh,
  };
}
