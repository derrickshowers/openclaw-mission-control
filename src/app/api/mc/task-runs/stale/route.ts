import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.MC_API_URL || "http://localhost:3001";
const API_KEY = process.env.MISSION_API_KEY || "";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const qs = searchParams.toString();

  const res = await fetch(
    `${API_BASE}/api/task-runs/stale${qs ? `?${qs}` : ""}`,
    {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
      },
    }
  );

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
