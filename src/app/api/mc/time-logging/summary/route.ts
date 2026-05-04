import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/mission-api";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const week = searchParams.get("week");
  const includeMonthly = searchParams.get("includeMonthly");
  const proxyParams = new URLSearchParams();

  if (week) proxyParams.set("week", week);
  if (includeMonthly) proxyParams.set("includeMonthly", includeMonthly);

  const query = proxyParams.toString();
  const path = query ? `/time-logging/summary?${query}` : "/time-logging/summary";

  return proxyRequest(request, path);
}
