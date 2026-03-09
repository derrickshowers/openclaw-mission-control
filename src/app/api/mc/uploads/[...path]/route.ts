import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.MISSION_API_URL || "http://localhost:3001";
const API_KEY = process.env.MISSION_API_KEY || "";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const filePath = path.join("/");

  try {
    const res = await fetch(`${API_BASE}/api/uploads/${filePath}`, {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
      },
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Not found" }, { status: res.status });
    }

    const contentType = res.headers.get("content-type") || "application/octet-stream";
    const buffer = await res.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Proxy error", detail: err.message },
      { status: 502 }
    );
  }
}
