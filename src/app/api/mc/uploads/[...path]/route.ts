import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const API_BASE = process.env.MISSION_API_URL || "http://localhost:3001";
const API_KEY = process.env.MISSION_API_KEY || "";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  // Auth check (middleware excluded this route to avoid redirect-breaking <img> tags)
  const session = await auth();
  if (!session?.user) {
    return new NextResponse(null, { status: 401 });
  }

  const { path } = await params;
  const filePath = path.join("/");

  // Validate path: only allow alphanumeric filenames with extensions
  if (!/^[\w\-]+\.\w+$/.test(filePath)) {
    return new NextResponse(null, { status: 400 });
  }

  try {
    const res = await fetch(`${API_BASE}/api/uploads/${filePath}`, {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
      },
    });

    if (!res.ok) {
      return new NextResponse(null, { status: res.status });
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
    return new NextResponse(null, { status: 502 });
  }
}
