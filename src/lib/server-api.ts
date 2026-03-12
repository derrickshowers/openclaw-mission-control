// Server-side only — calls VPS proxy directly with API key
// Used by server components that can't go through Next.js API routes
// (middleware blocks internal server-to-server calls that lack a session cookie)

import type { PersonalTask, PersonalTaskSummary, Project, Task } from "./api";

const API_URL = process.env.MISSION_API_URL || "http://localhost:3001";
const API_KEY = process.env.MISSION_API_KEY || "";

async function serverFetch<T = any>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}/api${path}`, {
    headers: { Authorization: `Bearer ${API_KEY}` },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Server API error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

export const serverApi = {
  getTasks: (params?: { status?: string; assignee?: string; project_id?: string }) => {
    const searchParams = new URLSearchParams(
      Object.entries(params || {}).filter(([, v]) => v !== undefined) as [string, string][]
    );
    const qs = searchParams.toString();
    return serverFetch<Task[]>(`/tasks${qs ? `?${qs}` : ""}`);
  },
  getProjects: (params?: { include_archived?: boolean }) => {
    const searchParams = new URLSearchParams();
    if (params?.include_archived) {
      searchParams.set("include_archived", "1");
    }
    const qs = searchParams.toString();
    return serverFetch<Project[]>(`/projects${qs ? `?${qs}` : ""}`);
  },
  getPersonalTasks: (params?: {
    status?: string;
    sync_state?: string;
    linked?: "linked" | "unlinked";
    due?: "overdue" | "today" | "soon";
    include_archived?: boolean;
    sort?: "due" | "updated" | "priority";
    limit?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set("status", params.status);
    if (params?.sync_state) searchParams.set("sync_state", params.sync_state);
    if (params?.linked) searchParams.set("linked", params.linked);
    if (params?.due) searchParams.set("due", params.due);
    if (params?.sort) searchParams.set("sort", params.sort);
    if (params?.include_archived) searchParams.set("include_archived", "1");
    if (typeof params?.limit === "number") searchParams.set("limit", String(params.limit));
    const qs = searchParams.toString();
    return serverFetch<PersonalTask[]>(`/personal-tasks${qs ? `?${qs}` : ""}`);
  },
  getPersonalTaskSummary: () => serverFetch<PersonalTaskSummary>("/personal-tasks?summary=1"),
  getAgents: () => serverFetch<any[]>("/agents"),
  getStatus: () => serverFetch<any>("/system/status"),
  getActivity: (params?: { limit?: string }) => {
    const qs = params?.limit ? `?limit=${params.limit}` : "";
    return serverFetch<any[]>(`/activity${qs}`);
  },
};
