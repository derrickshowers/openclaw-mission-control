import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/mission-api";

export async function DELETE(request: NextRequest) {
  const docPath = request.nextUrl.searchParams.get("path") || "";
  return proxyRequest(request, `/docs/delete?path=${encodeURIComponent(docPath)}`);
}
