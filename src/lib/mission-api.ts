import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.MISSION_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
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

    const responseHeaders = new Headers();
    const contentTypeHeader = res.headers.get("content-type");
    if (contentTypeHeader) responseHeaders.set("Content-Type", contentTypeHeader);

    const passthroughHeaders = [
      "cache-control",
      "etag",
      "last-modified",
      "x-log-date",
      "x-log-file",
      "x-log-cursor",
    ] as const;

    for (const header of passthroughHeaders) {
      const value = res.headers.get(header);
      if (value) {
        responseHeaders.set(header, value);
      }
    }

    if (res.status === 304) {
      return new NextResponse(null, { status: 304, headers: responseHeaders });
    }

    const contentType = contentTypeHeader?.toLowerCase() || "";
    if (contentType.includes("application/json")) {
      const data = await res.json();
      return NextResponse.json(data, { status: res.status, headers: responseHeaders });
    }

    const buffer = await res.arrayBuffer();
    return new NextResponse(buffer, { status: res.status, headers: responseHeaders });
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : "Unknown proxy error";
    return NextResponse.json(
      { error: "Proxy error", detail },
      { status: 502 }
    );
  }
}
