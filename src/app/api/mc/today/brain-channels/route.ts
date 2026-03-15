import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/mission-api";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams.toString();
  const path = searchParams ? `/today/brain-channels?${searchParams}` : "/today/brain-channels";
  return proxyRequest(request, path);
}
