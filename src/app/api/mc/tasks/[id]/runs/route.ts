import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const API_BASE =
  process.env.MISSION_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.MC_API_URL ||
  "http://localhost:3001";
const API_KEY = process.env.MISSION_API_KEY || "";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const searchParams = request.nextUrl.searchParams;
  const qs = searchParams.toString();

  try {
    const res = await fetch(
      `${API_BASE}/api/tasks/${id}/runs${qs ? `?${qs}` : ""}`,
      {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${API_KEY}`,
        },
      }
    );

    const contentType = res.headers.get("content-type")?.toLowerCase() || "";
    const headers = {
      "Cache-Control": "no-store, max-age=0",
    };

    if (contentType.includes("application/json")) {
      const data = await res.json();
      return NextResponse.json(data, {
        status: res.status,
        headers,
      });
    }

    const detail = await res.text();
    return NextResponse.json(
      {
        error: "Unexpected upstream response",
        detail,
      },
      {
        status: res.status,
        headers,
      }
    );
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : "Unknown proxy error";
    return NextResponse.json(
      {
        error: "Proxy error",
        detail,
      },
      {
        status: 502,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  }
}
