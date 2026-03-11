// Server-side only — calls VPS proxy directly with API key
// Used by server components that can't go through Next.js API routes
// (middleware blocks internal server-to-server calls that lack a session cookie)

import type { Project, Task } from "./api";

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
  getAgents: () => serverFetch<any[]>("/agents"),
  getStatus: () => serverFetch<any>("/system/status"),
  getActivity: (params?: { limit?: string }) => {
    const qs = params?.limit ? `?limit=${params.limit}` : "";
    return serverFetch<any[]>(`/activity${qs}`);
  },
};
