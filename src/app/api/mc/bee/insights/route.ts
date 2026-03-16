import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/mission-api";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams.toString();
  const path = searchParams ? `/bee/insights?${searchParams}` : "/bee/insights";
  return proxyRequest(request, path);
}
