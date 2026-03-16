// Bee Insights store
// - Seeds mock data for QA when no live Bee source is configured.
// - Preserves accept/dismiss state locally while allowing live data refreshes.

export type BeeInsightStatus = "new" | "accepted" | "dismissed";
export type BeeInsightConfidence = "high" | "medium" | "low";
export type BeeInsightSourceType = "conversation" | "daily_summary" | "journal" | "bee_todo";
export type BeeInsightOrigin = "mock" | "bee_proxy";

export interface StoredBeeInsight {
  id: string;
  title: string;
  source_type: BeeInsightSourceType;
  source_id: string;
  confidence: BeeInsightConfidence;
  confidence_reason: string;
  evidence: string;
  captured_at: string;
  status: BeeInsightStatus;
  notion_page_id: string | null;
  updated_at: string;
  ingestion_origin: BeeInsightOrigin;
  alarm_at: string | null;
}

const now = new Date();
function minsAgo(m: number) {
  return new Date(now.getTime() - m * 60_000).toISOString();
}

const INITIAL_INSIGHTS: StoredBeeInsight[] = [
  {
    id: "bee-ins-001",
    title: "Follow up with Alex on the API proposal",
    source_type: "conversation",
    source_id: "conv-1a2b3c",
    confidence: "high",
    confidence_reason: "explicit_commitment",
    evidence: "\"I'll get back to you on the API proposal by end of week — let me review the latency requirements first.\"",
    captured_at: minsAgo(42),
    status: "new",
    notion_page_id: null,
    updated_at: minsAgo(42),
    ingestion_origin: "mock",
    alarm_at: null,
  },
  {
    id: "bee-ins-002",
    title: "Schedule dentist appointment",
    source_type: "daily_summary",
    source_id: "daily-2026-03-15",
    confidence: "medium",
    confidence_reason: "repeated_mention",
    evidence: "Mentioned scheduling a dentist appointment twice today — once in the morning and once after lunch.",
    captured_at: minsAgo(118),
    status: "new",
    notion_page_id: null,
    updated_at: minsAgo(118),
    ingestion_origin: "mock",
    alarm_at: null,
  },
  {
    id: "bee-ins-003",
    title: "Renew car insurance before March 20th",
    source_type: "conversation",
    source_id: "conv-4d5e6f",
    confidence: "high",
    confidence_reason: "deadline_mentioned",
    evidence: "\"Oh right, I need to renew the car insurance — the policy expires on the 20th and I keep forgetting.\"",
    captured_at: minsAgo(215),
    status: "new",
    notion_page_id: null,
    updated_at: minsAgo(215),
    ingestion_origin: "mock",
    alarm_at: "2026-03-20",
  },
  {
    id: "bee-ins-004",
    title: "Send Jordan the onboarding checklist",
    source_type: "bee_todo",
    source_id: "btodo-7g8h9i",
    confidence: "high",
    confidence_reason: "existing_bee_todo",
    evidence: "Bee todo created: \"Send Jordan onboarding doc\" — no matching Notion task found.",
    captured_at: minsAgo(330),
    status: "new",
    notion_page_id: null,
    updated_at: minsAgo(330),
    ingestion_origin: "mock",
    alarm_at: null,
  },
  {
    id: "bee-ins-005",
    title: "Look into memory usage spike in the prod agent",
    source_type: "journal",
    source_id: "journal-2026-03-15",
    confidence: "medium",
    confidence_reason: "follow_up_request",
    evidence: "\"I should dig into that memory spike when I get a chance — it showed up three times this week in the logs.\"",
    captured_at: minsAgo(480),
    status: "new",
    notion_page_id: null,
    updated_at: minsAgo(480),
    ingestion_origin: "mock",
    alarm_at: null,
  },
];

const store = new Map<string, StoredBeeInsight>();
let mockSeeded = false;

export function ensureMockInsights() {
  if (mockSeeded) return;
  for (const insight of INITIAL_INSIGHTS) {
    store.set(insight.id, { ...insight });
  }
  mockSeeded = true;
}

export function listInsights(statuses?: BeeInsightStatus[]): StoredBeeInsight[] {
  const all = Array.from(store.values());
  if (statuses && statuses.length > 0) {
    return all.filter((i) => statuses.includes(i.status));
  }
  return all;
}

export function getInsight(id: string): StoredBeeInsight | undefined {
  return store.get(id);
}

export function replaceInsightsByOrigin(origin: BeeInsightOrigin, incoming: StoredBeeInsight[]) {
  const incomingIds = new Set(incoming.map((item) => item.id));

  for (const [id, insight] of store.entries()) {
    if (insight.ingestion_origin === origin && !incomingIds.has(id)) {
      store.delete(id);
    }
  }

  for (const insight of incoming) {
    const existing = store.get(insight.id);
    store.set(insight.id, {
      ...insight,
      status: existing?.status ?? insight.status,
      notion_page_id: existing?.notion_page_id ?? insight.notion_page_id,
      updated_at: new Date().toISOString(),
    });
  }
}

export function updateInsight(
  id: string,
  patch: Partial<Pick<StoredBeeInsight, "status" | "notion_page_id">>
): StoredBeeInsight | undefined {
  const insight = store.get(id);
  if (!insight) return undefined;
  const updated = { ...insight, ...patch, updated_at: new Date().toISOString() };
  store.set(id, updated);
  return updated;
}
