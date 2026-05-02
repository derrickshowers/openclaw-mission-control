import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/mission-api";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const week = searchParams.get("week");
  const path = week
    ? `/time-logging/summary?week=${encodeURIComponent(week)}`
    : "/time-logging/summary";

  return proxyRequest(request, path);
}
