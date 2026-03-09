import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/mission-api";

export async function POST(request: NextRequest) {
  return proxyRequest(request, "/usage");
}

export async function GET(request: NextRequest) {
  const limit = request.nextUrl.searchParams.get("limit") || "25";
  return proxyRequest(request, `/usage/log?limit=${encodeURIComponent(limit)}`);
}
