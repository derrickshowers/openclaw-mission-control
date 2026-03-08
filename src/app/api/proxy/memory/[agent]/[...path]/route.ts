import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/proxy";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agent: string; path: string[] }> }
) {
  const { agent, path } = await params;
  const filePath = path.join("/");
  return proxyRequest(request, `/memory/${agent}/${filePath}`);
}
