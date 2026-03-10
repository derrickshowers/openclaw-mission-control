import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/mission-api";

export async function PATCH(request: NextRequest) {
  return proxyRequest(request, "/docs/rename");
}
