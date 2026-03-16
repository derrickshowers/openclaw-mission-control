// Mock in-memory store for Bee insights (web-layer mock, no API backend needed)
// This is intentionally self-contained until a real Bee ingestion worker exists.

export type BeeInsightStatus = "new" | "accepted" | "dismissed";
export type BeeInsightConfidence = "high" | "medium" | "low";
export type BeeInsightSourceType = "conversation" | "daily_summary" | "journal" | "bee_todo";

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
  },
];

// Module-level store — persists for the lifetime of the Next.js server process
const store = new Map<string, StoredBeeInsight>(
  INITIAL_INSIGHTS.map((i) => [i.id, { ...i }])
);

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
