/**
 * Date/time utilities for Mission Control.
 *
 * The API stores timestamps in UTC without a trailing "Z" (e.g. "2026-03-10 15:11:19").
 * Browsers interpret bare date-time strings as local time, so we must ensure they are
 * parsed as UTC before any display conversion.
 */

/**
 * Parse a backend timestamp as UTC.
 * Accepts strings, numbers (epoch), or Date objects so UI callers don't crash on
 * inconsistent payload types.
 */
export function parseUTC(dateValue: string | number | Date | null | undefined): Date {
  if (dateValue == null) return new Date(NaN);

  if (dateValue instanceof Date) {
    return new Date(dateValue.getTime());
  }

  if (typeof dateValue === "number") {
    return new Date(dateValue);
  }

  if (typeof dateValue !== "string") return new Date(NaN);

  const dateStr = dateValue.trim();
  if (!dateStr) return new Date(NaN);

  const normalized = dateStr.replace(" ", "T");
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized);

  if (hasTimezone) {
    return new Date(normalized);
  }

  // No timezone info (e.g. SQLite "YYYY-MM-DD HH:MM:SS" or bare ISO) — treat as UTC.
  return new Date(`${normalized}Z`);
}

function fallbackDateLabel(dateValue: string | number | Date | null | undefined): string {
  if (typeof dateValue === "string") return dateValue;
  if (typeof dateValue === "number") return String(dateValue);
  return "";
}

/**
 * Format a backend timestamp as a locale string in the user's local timezone.
 */
export function formatLocal(dateValue: string | number | Date | null | undefined): string {
  const d = parseUTC(dateValue);
  if (isNaN(d.getTime())) return fallbackDateLabel(dateValue);
  return d.toLocaleString();
}

/**
 * Format a backend timestamp as a locale time string (no date).
 */
export function formatLocalTime(dateValue: string | number | Date | null | undefined): string {
  const d = parseUTC(dateValue);
  if (isNaN(d.getTime())) return fallbackDateLabel(dateValue);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * Relative time string ("3m ago", "2h ago", "5d ago") from a backend UTC timestamp.
 */
export function timeAgo(dateValue: string | number | Date | null | undefined): string {
  const d = parseUTC(dateValue);
  if (isNaN(d.getTime())) return fallbackDateLabel(dateValue);
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
