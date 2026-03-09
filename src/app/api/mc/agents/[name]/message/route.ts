import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/mission-api";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  return proxyRequest(request, `/agents/${name}/message`);
}
