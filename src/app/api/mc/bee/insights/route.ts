import { NextRequest, NextResponse } from "next/server";
import { listInsights, type BeeInsightStatus } from "./_store";

export async function GET(request: NextRequest) {
  const status = request.nextUrl.searchParams.get("status");
  // Default: return only "new" insights; pass status=all for everything
  const statuses: BeeInsightStatus[] | undefined =
    status === "all"
      ? undefined
      : status && ["new", "accepted", "dismissed"].includes(status)
        ? [status as BeeInsightStatus]
        : ["new"];

  const insights = listInsights(statuses).sort(
    (a, b) => new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime()
  );

  return NextResponse.json(insights);
}
