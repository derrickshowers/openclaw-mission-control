import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/mission-api";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  return proxyRequest(request, `/agents/sessions/compact/cancel/${jobId}`);
}
