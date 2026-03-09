import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/mission-api";

export async function GET(request: NextRequest) {
  const days = request.nextUrl.searchParams.get("days") || "7";
  return proxyRequest(request, `/usage/chart?days=${encodeURIComponent(days)}`);
}
