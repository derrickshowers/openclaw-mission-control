import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams.toString();
  const path = searchParams ? `/activity?${searchParams}` : "/activity";
  return proxyRequest(request, path);
}
