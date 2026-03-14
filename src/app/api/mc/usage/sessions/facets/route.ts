import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/mission-api";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.toString();
  const path = query ? `/usage/sessions/facets?${query}` : "/usage/sessions/facets";
  return proxyRequest(request, path);
}
