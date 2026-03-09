import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/mission-api";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyRequest(request, `/attachments/${id}`);
}
