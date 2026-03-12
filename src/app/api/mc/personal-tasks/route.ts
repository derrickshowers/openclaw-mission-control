import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/mission-api";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams.toString();
  const path = searchParams ? `/personal-tasks?${searchParams}` : "/personal-tasks";
  return proxyRequest(request, path);
}
