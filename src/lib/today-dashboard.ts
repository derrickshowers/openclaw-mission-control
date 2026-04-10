import type { BrainChannelSummary, TodayNonNegotiable } from "./api";
import { parseDate, type DateValue } from "@internationalized/date";

export interface TodayUsageSummary {
  provider: string;
  tokens: number;
  cost: number;
}

export interface TodayUsageBreakdownRow {
  model?: string | null;
  total_tokens?: number | string | null;
  input_tokens?: number | string | null;
  cached_input_tokens?: number | string | null;
  output_tokens?: number | string | null;
  cost_usd?: number | string | null;
}

export interface TodayDashboardSnapshot {
  dayKey: string;
  fetchedAt: string;
  nonNegotiables: TodayNonNegotiable[];
  brainChannels: BrainChannelSummary[];
  usageByProvider: TodayUsageSummary[];
}

export const TODAY_DASHBOARD_CACHE_KEY = "mission-control:today-dashboard:v1";

export function toLocalDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function startOfLocalDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function providerFromModel(model: string) {
  if (!model) return "other";
  if (model.includes("/")) return model.split("/")[0];
  return model.split("-")[0] || "other";
}

export function formatCompactNumber(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(Math.round(value));
}

export function formatUsd(value: number) {
  if (value < 0.01) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(2)}`;
}

export function normalizeTodayUsage(rows: TodayUsageBreakdownRow[]): TodayUsageSummary[] {
  const grouped = new Map<string, TodayUsageSummary>();

  for (const row of Array.isArray(rows) ? rows : []) {
    const provider = providerFromModel(String(row.model || "other"));
    const entry = grouped.get(provider) || { provider, tokens: 0, cost: 0 };
    const totalTokens =
      row.total_tokens !== undefined
        ? Number(row.total_tokens || 0)
        : Number(row.input_tokens || 0) + Number(row.cached_input_tokens || 0) + Number(row.output_tokens || 0);

    entry.tokens += totalTokens;
    entry.cost += Number(row.cost_usd || 0);
    grouped.set(provider, entry);
  }

  return Array.from(grouped.values()).sort((a, b) => b.cost - a.cost || b.tokens - a.tokens);
}

export function readTodayDashboardCache(dayKey: string): TodayDashboardSnapshot | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(TODAY_DASHBOARD_CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as TodayDashboardSnapshot;
    if (!parsed || parsed.dayKey !== dayKey) return null;
    if (!Array.isArray(parsed.nonNegotiables) || !Array.isArray(parsed.brainChannels) || !Array.isArray(parsed.usageByProvider)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function writeTodayDashboardCache(snapshot: TodayDashboardSnapshot) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(TODAY_DASHBOARD_CACHE_KEY, JSON.stringify(snapshot));
  } catch {
    // non-fatal: cache is just a fast path
  }
}

const DATE_ONLY_VALUE_RE = /^(\d{4})-(\d{2})-(\d{2})(?:T00:00:00(?:\.000)?Z)?$/;

function parseCalendarDate(dateValue: string | null | undefined) {
  if (!dateValue) return null;

  const trimmed = dateValue.trim();
  const dateOnlyMatch = trimmed.match(DATE_ONLY_VALUE_RE);
  if (dateOnlyMatch) {
    return new Date(
      Number(dateOnlyMatch[1]),
      Number(dateOnlyMatch[2]) - 1,
      Number(dateOnlyMatch[3])
    );
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function nextFridayDateKey(now = new Date()) {
  const d = new Date(now);
  const day = d.getDay();
  const friday = 5;
  let delta = (friday - day + 7) % 7;
  if (delta === 0) delta = 7;
  d.setDate(d.getDate() + delta);
  return toLocalDateKey(d);
}

export function toDateInputValue(dateValue: string | null | undefined, fallback = "") {
  const parsed = parseCalendarDate(dateValue);
  return parsed ? toLocalDateKey(parsed) : fallback;
}

export function toCalendarDateValue(dateValue: string | null | undefined): DateValue | null {
  const parsed = parseCalendarDate(dateValue);
  if (!parsed) return null;
  return parseDate(toLocalDateKey(parsed));
}

export function toIsoDateFromCalendar(value: DateValue | null): string | null {
  if (!value) return null;
  return value.toString();
}
