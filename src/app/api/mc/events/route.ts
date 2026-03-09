import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/mission-api";

export async function GET(request: NextRequest) {
  const start = request.nextUrl.searchParams.get("start") || "";
  const end = request.nextUrl.searchParams.get("end") || "";
  let path = "/events?";
  if (start) path += `start=${encodeURIComponent(start)}&`;
  if (end) path += `end=${encodeURIComponent(end)}`;
  return proxyRequest(request, path);
}

export async function POST(request: NextRequest) {
  return proxyRequest(request, "/events");
}
