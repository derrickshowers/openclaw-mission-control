import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/mission-api";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") || "";
  return proxyRequest(request, `/docs/search?q=${encodeURIComponent(q)}`);
}
