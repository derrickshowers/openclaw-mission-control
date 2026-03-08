const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://api.mission.showerstech.com";
const API_KEY = process.env.MISSION_API_KEY || "";

interface FetchOptions extends RequestInit {
  params?: Record<string, string>;
}

async function apiFetch<T = any>(path: string, options: FetchOptions = {}): Promise<T> {
  const { params, ...fetchOptions } = options;

  let url = `${API_BASE}/api${path}`;
  if (params) {
    const searchParams = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== "")
    );
    if (searchParams.toString()) {
      url += `?${searchParams.toString()}`;
    }
  }

  const res = await fetch(url, {
    ...fetchOptions,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
      ...fetchOptions.headers,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || `API error: ${res.status}`);
  }

  return res.json();
}

// Tasks
export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: "backlog" | "in_progress" | "blocked" | "done";
  assignee: string | null;
  priority: number;
  tags: string | null;
  position: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export const api = {
  // Tasks
  getTasks: (params?: { status?: string; assignee?: string }) =>
    apiFetch<Task[]>("/tasks", { params: params as Record<string, string> }),

  getTask: (id: string) => apiFetch<Task>(`/tasks/${id}`),

  createTask: (data: { title: string; description?: string; assignee?: string; priority?: number; tags?: string[]; status?: string }) =>
    apiFetch<Task>("/tasks", { method: "POST", body: JSON.stringify(data) }),

  updateTask: (id: string, data: Partial<Pick<Task, "title" | "description" | "status" | "assignee" | "priority" | "position">>) =>
    apiFetch<Task>(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  deleteTask: (id: string) =>
    apiFetch(`/tasks/${id}`, { method: "DELETE" }),

  moveTask: (id: string, status: string, position: number) =>
    apiFetch<Task>(`/tasks/${id}/position`, { method: "PATCH", body: JSON.stringify({ status, position }) }),

  // Agents
  getAgents: () => apiFetch<any[]>("/agents"),
  getAgent: (name: string) => apiFetch<any>(`/agents/${name}`),
  getAgentSessions: (name: string) => apiFetch<any[]>(`/agents/${name}/sessions`),
  sendMessage: (name: string, message: string) =>
    apiFetch(`/agents/${name}/message`, { method: "POST", body: JSON.stringify({ message }) }),

  // Memory
  getMemoryTree: () => apiFetch<Record<string, any>>("/memory"),
  getAgentMemory: (agent: string, dir?: string) =>
    apiFetch<any[]>(`/memory/${agent}`, { params: dir ? { dir } : undefined }),
  readMemoryFile: (agent: string, path: string) =>
    apiFetch<{ agent: string; path: string; content: string }>(`/memory/${agent}/${path}`),
  searchMemory: (query: string, agent?: string) =>
    apiFetch<any[]>("/memory/search", { params: { q: query, ...(agent ? { agent } : {}) } }),

  // Activity
  getActivity: (params?: { agent?: string; type?: string; limit?: string }) =>
    apiFetch<any[]>("/activity", { params: params as Record<string, string> }),

  // System
  getHealth: () => apiFetch<any>("/health"),
  getStatus: () => apiFetch<any>("/system/status"),
};
