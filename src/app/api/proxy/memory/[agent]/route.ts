import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agent: string }> }
) {
  const { agent } = await params;
  const dir = request.nextUrl.searchParams.get("dir");
  const path = dir ? `/memory/${agent}?dir=${encodeURIComponent(dir)}` : `/memory/${agent}`;
  return proxyRequest(request, path);
}
