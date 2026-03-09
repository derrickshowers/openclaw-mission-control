import { NextRequest, NextResponse } from "next/server";
import { proxyRequest } from "@/lib/mission-api";

const API_BASE = process.env.MISSION_API_URL || "http://localhost:3001";
const API_KEY = process.env.MISSION_API_KEY || "";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyRequest(request, `/tasks/${id}/attachments`);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Forward the raw multipart body to the proxy — can't use proxyRequest
  // because it reads body as text which corrupts binary data
  try {
    const res = await fetch(`${API_BASE}/api/tasks/${id}/attachments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": request.headers.get("content-type") || "",
      },
      body: request.body,
      // @ts-ignore — duplex needed for streaming body in Node.js fetch
      duplex: "half",
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Proxy error", detail: err.message },
      { status: 502 }
    );
  }
}
