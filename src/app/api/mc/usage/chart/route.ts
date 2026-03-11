import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/mission-api";

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams;
  const start = search.get("start");
  const end = search.get("end");
  const days = search.get("days") || "7";
  const interval = search.get("interval") || "day";
  const tzOffset = search.get("tzOffset") || "0";

  const params = new URLSearchParams();
  if (start && end) {
    params.set("start", start);
    params.set("end", end);
  } else {
    params.set("days", days);
  }
  params.set("interval", interval);
  params.set("tzOffset", tzOffset);

  return proxyRequest(request, `/usage/chart?${params.toString()}`);
}
