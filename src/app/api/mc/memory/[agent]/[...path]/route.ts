import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/mission-api";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agent: string; path: string[] }> }
) {
  const { agent, path } = await params;
  const filePath = path.join("/");
  return proxyRequest(request, `/memory/${agent}/${filePath}`);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ agent: string; path: string[] }> }
) {
  const { agent, path } = await params;
  const filePath = path.join("/");
  return proxyRequest(request, `/memory/${agent}/${filePath}`);
}
