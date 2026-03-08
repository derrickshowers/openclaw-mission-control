import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.PROXY_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const API_KEY = process.env.MISSION_API_KEY || "";

export async function proxyRequest(
  request: NextRequest,
  path: string
): Promise<NextResponse> {
  const url = `${API_BASE}/api${path}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${API_KEY}`,
  };

  const contentType = request.headers.get("content-type");
  if (contentType) {
    headers["Content-Type"] = contentType;
  }

  let body: string | undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    body = await request.text();
  }

  try {
    const res = await fetch(url, {
      method: request.method,
      headers,
      body,
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
