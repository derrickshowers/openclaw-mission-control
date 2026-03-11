import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/mission-api";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  return proxyRequest(request, `/agents/sessions/compact/status/${jobId}`);
}
