import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/mission-api";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const qs = request.nextUrl.searchParams.toString();
  return proxyRequest(request, `/agents/${name}/avatar${qs ? `?${qs}` : ""}`);
}
