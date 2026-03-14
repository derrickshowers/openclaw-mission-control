import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/mission-api";

export async function POST(request: NextRequest) {
  return proxyRequest(request, "/usage");
}

export async function GET(request: NextRequest) {
  const params = new URLSearchParams();
  const limit = request.nextUrl.searchParams.get("limit") || "25";
  params.set("limit", limit);

  const hideLegacyDuplicates = request.nextUrl.searchParams.get("hideLegacyDuplicates");
  if (hideLegacyDuplicates) {
    params.set("hideLegacyDuplicates", hideLegacyDuplicates);
  }

  return proxyRequest(request, `/usage/log?${params.toString()}`);
}
