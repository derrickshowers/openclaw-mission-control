import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/mission-api";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyRequest(request, `/bee/insights/${id}`);
}
