/**
 * Date/time utilities for Mission Control.
 *
 * The API stores timestamps in UTC without a trailing "Z" (e.g. "2026-03-10 15:11:19").
 * Browsers interpret bare date-time strings as local time, so we must ensure they are
 * parsed as UTC before any display conversion.
 */

/**
 * Parse a date string from the backend as UTC.
 * Handles strings with or without "Z" suffix and space-separated date/time.
 */
export function parseUTC(dateStr: string): Date {
  if (!dateStr) return new Date(NaN);
  if (dateStr.endsWith("Z") || dateStr.includes("+") || dateStr.includes("T")) {
    // Already has timezone info or ISO format
    return new Date(dateStr.endsWith("Z") ? dateStr : dateStr.replace(" ", "T") + "Z");
  }
  // Bare "YYYY-MM-DD HH:MM:SS" from SQLite — treat as UTC
  return new Date(dateStr.replace(" ", "T") + "Z");
}

/**
 * Format a backend timestamp as a locale string in the user's local timezone.
 */
export function formatLocal(dateStr: string): string {
  const d = parseUTC(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleString();
}

/**
 * Format a backend timestamp as a locale time string (no date).
 */
export function formatLocalTime(dateStr: string): string {
  const d = parseUTC(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * Relative time string ("3m ago", "2h ago", "5d ago") from a backend UTC timestamp.
 */
export function timeAgo(dateStr: string): string {
  const d = parseUTC(dateStr);
  if (isNaN(d.getTime())) return dateStr;
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
