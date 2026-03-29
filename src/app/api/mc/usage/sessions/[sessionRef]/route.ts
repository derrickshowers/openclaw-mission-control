import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/mission-api";

interface Context {
  params: Promise<{ sessionRef: string }>;
}

export async function GET(request: NextRequest, context: Context) {
  const { sessionRef } = await context.params;
  const query = request.nextUrl.searchParams.toString();
  const encodedRef = encodeURIComponent(sessionRef);
  const path = query
    ? `/usage/sessions/${encodedRef}?${query}`
    : `/usage/sessions/${encodedRef}`;

  return proxyRequest(request, path);
}

export async function POST(request: NextRequest, context: Context) {
  const { sessionRef } = await context.params;
  const encodedRef = encodeURIComponent(sessionRef);
  return proxyRequest(request, `/usage/sessions/${encodedRef}/message`);
}
