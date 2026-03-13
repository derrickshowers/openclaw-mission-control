// Client-side API — all calls go through Next.js /api/mc routes
// API key stays server-side, never exposed to the browser

interface FetchOptions extends RequestInit {
  params?: Record<string, string>;
}

function getBaseUrl() {
  // Server-side: need absolute URL
  if (typeof window === "undefined") {
    // Vercel provides this automatically
    const vercelUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL;
    if (vercelUrl) {
      return vercelUrl.startsWith("http") ? vercelUrl : `https://${vercelUrl}`;
    }
    return "http://localhost:3000";
  }
  // Client-side: relative URL works
  return "";
}

async function apiFetch<T = any>(path: string, options: FetchOptions = {}): Promise<T> {
  const { params, ...fetchOptions } = options;

  let url = `${getBaseUrl()}/api/mc${path}`;
  if (params) {
    const searchParams = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== "")
    );
    if (searchParams.toString()) {
      url += `?${searchParams.toString()}`;
    }
  }

  const headers = new Headers(fetchOptions.headers as HeadersInit);
  const hasBody = fetchOptions.body !== undefined && fetchOptions.body !== null;
  const isFormData = typeof FormData !== "undefined" && fetchOptions.body instanceof FormData;

  if (hasBody && !isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(url, {
    ...fetchOptions,
    headers,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || `API error: ${res.status}`);
  }

  return res.json();
}

export interface Project {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  owner: string | null;
  start_date?: string | null;
  target_date?: string | null;
  created_by?: string | null;
  color: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  last_activity_at?: string | null;
  task_summary?: {
    total: number;
    backlog: number;
    in_progress: number;
    blocked: number;
    done: number;
    progress: number;
  };
}

// Team tasks
export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: "backlog" | "in_progress" | "blocked" | "done";
  assignee: string | null;
  priority: number;
  tags: string | null;
  position: number;
  project_id: string | null;
  project?: Project | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

// Personal tasks
export interface PersonalTask {
  id: string;
  source: "notion";
  source_id: string;
  source_url: string | null;
  title: string;
  description: string | null;
  status: "backlog" | "in_progress" | "blocked" | "done";
  source_status: string | null;
  priority: number;
  due_at: string | null;
  scheduled_at: string | null;
  owner: string;
  source_last_edited_at: string | null;
  last_synced_at: string;
  sync_state: "active" | "archived" | "deleted" | "error";
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  link_count: number;
  open_link_count: number;
  delegation?: {
    task_id: string;
    title: string;
    status: string;
    assignee: string | null;
    delegated_at: string;
  } | null;
}

export interface PersonalTaskDetail extends PersonalTask {
  raw_payload?: Record<string, any>;
  linked_team_tasks: Array<{
    id: string;
    personal_task_id: string;
    team_task_id: string;
    relation: "delegated" | "related";
    created_by: string | null;
    created_at: string;
    team_task_deleted: boolean;
    team_task: {
      id: string;
      title: string;
      status: string;
      assignee: string | null;
      priority: number;
      project_id: string | null;
      project_name: string | null;
      updated_at: string;
    } | null;
  }>;
}

export interface PersonalTaskSummary {
  total: number;
  backlog: number;
  in_progress: number;
  blocked: number;
  done: number;
  overdue: number;
  due_today: number;
  linked: number;
  linked_open: number;
  last_synced_at: string | null;
}

export interface PersonalTaskSyncRun {
  id: string;
  provider: string;
  run_type: "incremental" | "full";
  trigger: "scheduled" | "manual" | "startup";
  status: "running" | "success" | "partial" | "failed" | "skipped";
  started_at: string;
  finished_at: string | null;
  window_start_at: string | null;
  window_end_at: string | null;
  cursor_start: string | null;
  cursor_end: string | null;
  seen_count: number;
  imported_count: number;
  updated_count: number;
  archived_count: number;
  error: string | null;
}

export interface PersonalTaskSyncResult {
  runId: string | null;
  status: "running" | "success" | "partial" | "failed" | "skipped";
  runType: "incremental" | "full";
  skipped?: boolean;
  reason?: string;
  counts: {
    seen: number;
    imported: number;
    updated: number;
    archived: number;
  };
  cursorStart: string | null;
  cursorEnd: string | null;
  error: string | null;
}

export interface TaskAttachment {
  id: string;
  task_id: string;
  filename: string;
  mime_type: string;
  size: number;
  uploaded_by: string;
  url: string;
  created_at: string;
}

export interface TaskComment {
  id: string;
  task_id: string;
  author: string;
  content: string;
  created_at: string;
}

type TaskUpdate = Partial<Pick<Task, "title" | "description" | "status" | "assignee" | "priority" | "position" | "project_id">> & {
  tags?: string[] | null;
};

export const api = {
  // Team tasks
  getTasks: (params?: { status?: string; assignee?: string; project_id?: string }) =>
    apiFetch<Task[]>("/tasks", { params: params as Record<string, string> }),

  getTask: (id: string) => apiFetch<Task>(`/tasks/${id}`),

  createTask: (data: {
    title: string;
    description?: string;
    assignee?: string;
    priority?: number;
    tags?: string[];
    status?: string;
    project_id?: string | null;
  }) =>
    apiFetch<Task>("/tasks", { method: "POST", body: JSON.stringify(data) }),

  updateTask: (id: string, data: TaskUpdate) =>
    apiFetch<Task>(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  deleteTask: (id: string) =>
    apiFetch(`/tasks/${id}`, { method: "DELETE" }),

  moveTask: (id: string, status: string, position: number) =>
    apiFetch<Task>(`/tasks/${id}/position`, { method: "PATCH", body: JSON.stringify({ status, position }) }),

  // Personal tasks
  getPersonalTasks: (params?: {
    status?: string;
    sync_state?: string;
    linked?: "linked" | "unlinked";
    due?: "overdue" | "today" | "soon";
    include_archived?: boolean;
    sort?: "due" | "updated" | "priority";
    limit?: number;
  }) =>
    apiFetch<PersonalTask[]>("/personal-tasks", {
      params: {
        status: params?.status || "",
        sync_state: params?.sync_state || "",
        linked: params?.linked || "",
        due: params?.due || "",
        sort: params?.sort || "",
        limit: params?.limit !== undefined ? String(params.limit) : "",
        include_archived: params?.include_archived ? "1" : "",
      },
    }),

  getPersonalTask: (id: string) => apiFetch<PersonalTaskDetail>(`/personal-tasks/${id}`),

  getPersonalTaskSummary: () =>
    apiFetch<PersonalTaskSummary>("/personal-tasks", { params: { summary: "1" } }),

  syncPersonalTasks: (runType: "incremental" | "full" = "incremental") =>
    apiFetch<PersonalTaskSyncResult>("/personal-tasks/sync", {
      method: "POST",
      body: JSON.stringify({ run_type: runType }),
    }),

  getPersonalTaskSyncRuns: (params?: { limit?: number; status?: string }) =>
    apiFetch<PersonalTaskSyncRun[]>("/personal-tasks/sync-runs", {
      params: {
        limit: params?.limit !== undefined ? String(params.limit) : "",
        status: params?.status || "",
      },
    }),

  promotePersonalTask: (
    id: string,
    data?: {
      title?: string;
      description?: string;
      assignee?: string;
      priority?: number;
      status?: "backlog" | "in_progress" | "blocked" | "done";
      project_id?: string | null;
      create_another?: boolean;
      relation?: "delegated" | "related";
    }
  ) =>
    apiFetch<any>(`/personal-tasks/${id}/promote`, {
      method: "POST",
      body: JSON.stringify(data || {}),
    }),

  // Projects
  getProjects: (params?: { include_archived?: boolean }) =>
    apiFetch<Project[]>("/projects", {
      params: params?.include_archived ? { include_archived: "1" } : undefined,
    }),

  getProject: (id: string) => apiFetch<Project>(`/projects/${id}`),

  createProject: (data: {
    name: string;
    slug?: string;
    description?: string;
    owner?: string;
    color?: string;
  }) => apiFetch<Project>("/projects", { method: "POST", body: JSON.stringify(data) }),

  updateProject: (id: string, data: Partial<Project> & { archived?: boolean }) =>
    apiFetch<Project>(`/projects/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  // Attachments
  getAttachments: (taskId: string) =>
    apiFetch<TaskAttachment[]>(`/tasks/${taskId}/attachments`),

  uploadAttachment: async (taskId: string, file: File, uploadedBy: string) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("uploaded_by", uploadedBy);

    const res = await fetch(`${getBaseUrl()}/api/mc/tasks/${taskId}/attachments`, {
      method: "POST",
      body: formData,
      // Do NOT set Content-Type — browser sets it with boundary
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(error.error || `Upload failed: ${res.status}`);
    }
    return res.json() as Promise<TaskAttachment>;
  },

  deleteAttachment: (attachmentId: string) =>
    apiFetch(`/attachments/${attachmentId}`, { method: "DELETE" }),

  // Comments
  getComments: (taskId: string) =>
    apiFetch<TaskComment[]>(`/tasks/${taskId}/comments`),

  addComment: (taskId: string, author: string, content: string) =>
    apiFetch<TaskComment>(`/tasks/${taskId}/comments`, {
      method: "POST",
      body: JSON.stringify({ author, content }),
    }),

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
  restartOpenClaw: () => apiFetch<any>("/system/restart", { method: "POST" }),
  runDoctor: (fix = false) =>
    apiFetch<any>("/system/doctor", {
      method: "POST",
      body: JSON.stringify({ fix }),
    }),
};
