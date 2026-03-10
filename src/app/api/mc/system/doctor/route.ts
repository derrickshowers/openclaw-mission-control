import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/mission-api";

export async function POST(request: NextRequest) {
  return proxyRequest(request, "/system/doctor");
}
