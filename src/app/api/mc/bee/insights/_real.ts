import { type BeeInsightOrigin, type StoredBeeInsight } from "./_store";

type BeeTodoRecord = Record<string, unknown>;

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function asArray(payload: unknown): BeeTodoRecord[] {
  if (Array.isArray(payload)) return payload as BeeTodoRecord[];
  if (!payload || typeof payload !== "object") return [];

  const record = payload as Record<string, unknown>;
  const candidates = [record.data, record.items, record.todos, record.results];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate as BeeTodoRecord[];
  }
  return [];
}

function asString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return null;
}

function asBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "yes";
  }
  return false;
}

function getBeeProxyConfig(): { baseUrl: string; origin: BeeInsightOrigin } | null {
  const proxyUrl = process.env.BEE_PROXY_URL?.trim();
  if (!proxyUrl) return null;

  return {
    baseUrl: trimTrailingSlash(proxyUrl),
    origin: "bee_proxy",
  };
}

function normalizeBeeTodo(todo: BeeTodoRecord, origin: BeeInsightOrigin): StoredBeeInsight | null {
  const sourceId = asString(todo.id, todo.todo_id, todo.uuid);
  const title = asString(todo.text, todo.title, todo.name);
  if (!sourceId || !title) return null;

  const completed = asBoolean(todo.completed) || asBoolean(todo.done);
  if (completed) return null;

  const createdAt =
    asString(todo.updated_at, todo.updatedAt, todo.created_at, todo.createdAt, todo.alarm_at, todo.alarmAt) ||
    new Date().toISOString();
  const alarmAt = asString(todo.alarm_at, todo.alarmAt, todo.due_at, todo.dueAt);
  const notes = asString(todo.note, todo.notes, todo.description);

  const evidenceParts = [] as string[];
  if (notes) evidenceParts.push(notes);
  if (alarmAt) evidenceParts.push(`Bee reminder: ${alarmAt}`);

  return {
    id: `bee-todo-${sourceId}`,
    title,
    source_type: "bee_todo",
    source_id: sourceId,
    confidence: "high",
    confidence_reason: "live_bee_todo",
    evidence: evidenceParts.length > 0 ? evidenceParts.join(" • ") : "Open Bee todo captured from the live Bee proxy.",
    captured_at: createdAt,
    status: "new",
    notion_page_id: null,
    updated_at: createdAt,
    ingestion_origin: origin,
    alarm_at: alarmAt,
  };
}

export async function loadRealBeeInsights(): Promise<StoredBeeInsight[] | null> {
  const config = getBeeProxyConfig();
  if (!config) return null;

  try {
    const response = await fetch(`${config.baseUrl}/v1/todos`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json().catch(() => null);
    const todos = asArray(payload);

    return todos
      .map((todo) => normalizeBeeTodo(todo, config.origin))
      .filter((todo): todo is StoredBeeInsight => !!todo);
  } catch {
    return null;
  }
}
