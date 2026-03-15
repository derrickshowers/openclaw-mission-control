import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/mission-api";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyRequest(request, `/personal-tasks/${id}/start-work`);
}
