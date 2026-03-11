import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/mission-api";

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams;
  const start = search.get("start");
  const end = search.get("end");
  const periodDays = search.get("periodDays");
  const days = search.get("days") || "7";

  const params = new URLSearchParams();
  if (start && end) {
    params.set("start", start);
    params.set("end", end);
    if (periodDays) params.set("periodDays", periodDays);
  } else {
    params.set("days", days);
  }

  return proxyRequest(request, `/usage/summary?${params.toString()}`);
}
