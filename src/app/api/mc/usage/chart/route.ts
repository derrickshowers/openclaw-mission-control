import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/mission-api";

export async function GET(request: NextRequest) {
  const days = request.nextUrl.searchParams.get("days") || "7";
  const interval = request.nextUrl.searchParams.get("interval") || "day";
  const tzOffset = request.nextUrl.searchParams.get("tzOffset") || "0";
  return proxyRequest(
    request,
    `/usage/chart?days=${encodeURIComponent(days)}&interval=${encodeURIComponent(interval)}&tzOffset=${encodeURIComponent(tzOffset)}`
  );
}
