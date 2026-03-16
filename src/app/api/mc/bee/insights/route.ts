import { NextRequest, NextResponse } from "next/server";
import { loadRealBeeInsights } from "./_real";
import { ensureMockInsights, listInsights, replaceInsightsByOrigin, type BeeInsightStatus } from "./_store";

export async function GET(request: NextRequest) {
  const status = request.nextUrl.searchParams.get("status");
  const statuses: BeeInsightStatus[] | undefined =
    status === "all"
      ? undefined
      : status && ["new", "accepted", "dismissed"].includes(status)
        ? [status as BeeInsightStatus]
        : ["new"];

  const liveInsights = await loadRealBeeInsights();
  if (liveInsights === null) {
    ensureMockInsights();
  } else {
    replaceInsightsByOrigin("bee_proxy", liveInsights);
  }

  const insights = listInsights(statuses).sort(
    (a, b) => new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime()
  );

  return NextResponse.json(insights);
}
