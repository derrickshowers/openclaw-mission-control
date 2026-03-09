import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/mission-api";

export async function GET(request: NextRequest) {
  const filePath = request.nextUrl.searchParams.get("path") || "";
  return proxyRequest(request, `/docs/read?path=${encodeURIComponent(filePath)}`);
}
