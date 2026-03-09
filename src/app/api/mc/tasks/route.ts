import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/mission-api";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams.toString();
  const path = searchParams ? `/tasks?${searchParams}` : "/tasks";
  return proxyRequest(request, path);
}

export async function POST(request: NextRequest) {
  return proxyRequest(request, "/tasks");
}
