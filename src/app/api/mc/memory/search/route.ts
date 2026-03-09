import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/mission-api";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") || "";
  const agent = request.nextUrl.searchParams.get("agent") || "";
  let path = `/memory/search?q=${encodeURIComponent(q)}`;
  if (agent) path += `&agent=${encodeURIComponent(agent)}`;
  return proxyRequest(request, path);
}
